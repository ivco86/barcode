/**
 * Marketing Automation Suite - v5.0
 * Email/SMS campaigns, segmentation, A/B testing, automation
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class MarketingAutomationService {
    constructor(customerService, salesService, analyticsService) {
        this.customerService = customerService;
        this.salesService = salesService;
        this.analyticsService = analyticsService;

        this.campaigns = StorageService.get('marketingCampaigns', []);
        this.templates = StorageService.get('marketingTemplates', this._getDefaultTemplates());
        this.segments = StorageService.get('customerSegments', []);
        this.automations = StorageService.get('marketingAutomations', []);
        this.campaignStats = StorageService.get('campaignStats', {});
    }

    /**
     * Create marketing campaign
     * @param {Object} campaignData - Campaign configuration
     * @returns {Object} Created campaign
     */
    createCampaign(campaignData) {
        const validation = this._validateCampaign(campaignData);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        const campaign = {
            id: Date.now(),
            name: ValidationService.sanitizeString(campaignData.name),
            type: campaignData.type, // 'email', 'sms', 'push'
            template: campaignData.template,
            segment: campaignData.segment,
            subject: ValidationService.sanitizeString(campaignData.subject || ''),
            content: ValidationService.sanitizeString(campaignData.content),
            schedule: campaignData.schedule, // 'immediate', 'scheduled', 'recurring'
            scheduledDate: campaignData.scheduledDate || null,
            recurringPattern: campaignData.recurringPattern || null,
            abTest: campaignData.abTest || false,
            abVariant: campaignData.abVariant || null,
            status: 'draft',
            createdAt: new Date().toISOString(),
            createdBy: campaignData.createdBy || 'System',
            stats: {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                converted: 0,
                revenue: 0
            }
        };

        this.campaigns.push(campaign);
        this._saveCampaigns();

        // Schedule if needed
        if (campaign.schedule === 'scheduled' && campaign.scheduledDate) {
            this._scheduleCampaign(campaign);
        } else if (campaign.schedule === 'immediate') {
            this.sendCampaign(campaign.id);
        }

        return {
            success: true,
            campaign: campaign
        };
    }

    /**
     * Send campaign
     * @param {number} campaignId - Campaign ID
     * @returns {Object} Send result
     */
    sendCampaign(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);

        if (!campaign) {
            return {
                success: false,
                errors: ['Кампанията не съществува']
            };
        }

        if (campaign.status === 'sent') {
            return {
                success: false,
                errors: ['Кампанията вече е изпратена']
            };
        }

        // Get recipients based on segment
        const recipients = this._getSegmentRecipients(campaign.segment);

        if (recipients.length === 0) {
            return {
                success: false,
                errors: ['Няма получатели за този сегмент']
            };
        }

        // Simulate sending
        const sendResults = this._simulateSend(campaign, recipients);

        // Update campaign stats
        campaign.status = 'sent';
        campaign.sentAt = new Date().toISOString();
        campaign.stats.sent = sendResults.sent;
        campaign.stats.delivered = sendResults.delivered;

        this._saveCampaigns();

        // Track in stats
        this._trackCampaignStats(campaign.id, {
            sent: sendResults.sent,
            delivered: sendResults.delivered
        });

        return {
            success: true,
            send: {
                campaignId: campaignId,
                campaignName: campaign.name,
                recipientCount: recipients.length,
                sent: sendResults.sent,
                delivered: sendResults.delivered,
                deliveryRate: Math.round((sendResults.delivered / sendResults.sent) * 100)
            }
        };
    }

    /**
     * Create customer segment
     * @param {Object} segmentData - Segment configuration
     * @returns {Object} Created segment
     */
    createSegment(segmentData) {
        const segment = {
            id: Date.now(),
            name: ValidationService.sanitizeString(segmentData.name),
            description: ValidationService.sanitizeString(segmentData.description || ''),
            type: segmentData.type, // 'manual', 'rfm', 'behavior', 'demographic'
            criteria: segmentData.criteria,
            createdAt: new Date().toISOString(),
            customerCount: 0
        };

        // Calculate customers in segment
        segment.customerCount = this._getSegmentRecipients(segment).length;

        this.segments.push(segment);
        this._saveSegments();

        return {
            success: true,
            segment: segment
        };
    }

    /**
     * Get segment recipients
     * @param {Object|string} segment - Segment object or ID
     * @returns {Array} Customer list
     */
    getSegmentRecipients(segment) {
        const recipients = this._getSegmentRecipients(segment);

        return {
            success: true,
            recipients: {
                customers: recipients,
                count: recipients.length
            }
        };
    }

    /**
     * Create automation workflow
     * @param {Object} automationData - Automation configuration
     * @returns {Object} Created automation
     */
    createAutomation(automationData) {
        const automation = {
            id: Date.now(),
            name: ValidationService.sanitizeString(automationData.name),
            trigger: automationData.trigger, // 'purchase', 'abandoned_cart', 'birthday', 'dormant', 'new_customer'
            delay: automationData.delay || 0, // Minutes to wait before sending
            type: automationData.type, // 'email', 'sms'
            template: automationData.template,
            active: automationData.active !== false,
            createdAt: new Date().toISOString(),
            stats: {
                triggered: 0,
                sent: 0,
                converted: 0
            }
        };

        this.automations.push(automation);
        this._saveAutomations();

        return {
            success: true,
            automation: automation
        };
    }

    /**
     * Trigger automation (called by system events)
     * @param {string} triggerType - Trigger type
     * @param {Object} data - Event data
     * @returns {Object} Result
     */
    triggerAutomation(triggerType, data) {
        const activeAutomations = this.automations.filter(a =>
            a.active && a.trigger === triggerType
        );

        if (activeAutomations.length === 0) {
            return {
                success: true,
                message: 'Няма активни автоматизации за този trigger'
            };
        }

        const triggered = [];

        activeAutomations.forEach(automation => {
            // Schedule automation with delay
            setTimeout(() => {
                this._executeAutomation(automation, data);
            }, automation.delay * 60 * 1000);

            automation.stats.triggered++;
            triggered.push(automation.id);
        });

        this._saveAutomations();

        return {
            success: true,
            triggered: {
                count: triggered.length,
                automationIds: triggered
            }
        };
    }

    /**
     * Get campaign performance
     * @param {number} campaignId - Campaign ID
     * @returns {Object} Performance metrics
     */
    getCampaignPerformance(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);

        if (!campaign) {
            return {
                success: false,
                errors: ['Кампанията не съществува']
            };
        }

        const stats = campaign.stats;
        const openRate = stats.delivered > 0 ? (stats.opened / stats.delivered) * 100 : 0;
        const clickRate = stats.opened > 0 ? (stats.clicked / stats.opened) * 100 : 0;
        const conversionRate = stats.sent > 0 ? (stats.converted / stats.sent) * 100 : 0;
        const roi = this._calculateROI(campaign);

        return {
            success: true,
            performance: {
                campaignId: campaignId,
                campaignName: campaign.name,
                status: campaign.status,
                sent: stats.sent,
                delivered: stats.delivered,
                opened: stats.opened,
                clicked: stats.clicked,
                converted: stats.converted,
                revenue: stats.revenue,
                metrics: {
                    deliveryRate: Math.round((stats.delivered / stats.sent) * 100),
                    openRate: Math.round(openRate * 10) / 10,
                    clickRate: Math.round(clickRate * 10) / 10,
                    conversionRate: Math.round(conversionRate * 10) / 10,
                    roi: Math.round(roi * 10) / 10
                },
                grade: this._getPerformanceGrade(openRate, clickRate, conversionRate)
            }
        };
    }

    /**
     * Get all campaigns
     * @param {string} status - Filter by status
     * @returns {Object} Campaigns list
     */
    getAllCampaigns(status = null) {
        let campaigns = this.campaigns;

        if (status) {
            campaigns = campaigns.filter(c => c.status === status);
        }

        return {
            success: true,
            campaigns: {
                campaigns: campaigns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
                totalCampaigns: campaigns.length
            }
        };
    }

    /**
     * Get marketing analytics
     * @param {string} period - Period
     * @returns {Object} Analytics
     */
    getMarketingAnalytics(period = 'month') {
        const campaigns = this._filterCampaignsByPeriod(this.campaigns, period);

        const totalSent = campaigns.reduce((sum, c) => sum + c.stats.sent, 0);
        const totalRevenue = campaigns.reduce((sum, c) => sum + c.stats.revenue, 0);
        const totalConverted = campaigns.reduce((sum, c) => sum + c.stats.converted, 0);

        // Best performing campaign
        const bestCampaign = campaigns.reduce((best, c) => {
            const bestRevenue = best.stats ? best.stats.revenue : 0;
            return c.stats.revenue > bestRevenue ? c : best;
        }, {});

        return {
            success: true,
            analytics: {
                period: period,
                totalCampaigns: campaigns.length,
                totalSent: totalSent,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalConversions: totalConverted,
                avgRevenuePerCampaign: campaigns.length > 0 ?
                                      Math.round((totalRevenue / campaigns.length) * 100) / 100 : 0,
                avgConversionRate: totalSent > 0 ?
                                  Math.round((totalConverted / totalSent) * 100 * 10) / 10 : 0,
                bestCampaign: bestCampaign.name ? {
                    name: bestCampaign.name,
                    revenue: bestCampaign.stats.revenue,
                    conversions: bestCampaign.stats.converted
                } : null
            }
        };
    }

    /**
     * Track campaign click
     * @param {number} campaignId - Campaign ID
     * @param {number} customerId - Customer ID
     * @returns {Object} Result
     */
    trackClick(campaignId, customerId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);

        if (!campaign) {
            return { success: false, errors: ['Кампанията не съществува'] };
        }

        campaign.stats.clicked++;
        this._saveCampaigns();

        return { success: true };
    }

    /**
     * Track campaign conversion
     * @param {number} campaignId - Campaign ID
     * @param {number} customerId - Customer ID
     * @param {number} revenue - Revenue from conversion
     * @returns {Object} Result
     */
    trackConversion(campaignId, customerId, revenue) {
        const campaign = this.campaigns.find(c => c.id === campaignId);

        if (!campaign) {
            return { success: false, errors: ['Кампанията не съществува'] };
        }

        campaign.stats.converted++;
        campaign.stats.revenue += revenue;
        this._saveCampaigns();

        return { success: true };
    }

    // ============ PRIVATE METHODS ============

    _validateCampaign(data) {
        const errors = [];

        if (!data.name || data.name.trim().length < 2) {
            errors.push('Името трябва да е минимум 2 символа');
        }

        if (!['email', 'sms', 'push'].includes(data.type)) {
            errors.push('Невалиден тип кампания');
        }

        if (!data.content || data.content.trim().length === 0) {
            errors.push('Липсва съдържание');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    _getSegmentRecipients(segment) {
        let customers = this.customerService.getAllCustomers();

        if (typeof segment === 'string') {
            // Predefined segments
            if (segment === 'all') {
                return customers;
            } else if (segment === 'vip') {
                return this._getVIPCustomers(customers);
            } else if (segment === 'new') {
                return this._getNewCustomers(customers);
            } else if (segment === 'dormant') {
                return this._getDormantCustomers(customers);
            } else {
                // Find custom segment
                const customSegment = this.segments.find(s => s.id === parseInt(segment) || s.name === segment);
                if (customSegment) {
                    return this._filterBySegmentCriteria(customers, customSegment.criteria);
                }
            }
        } else if (typeof segment === 'object' && segment.criteria) {
            return this._filterBySegmentCriteria(customers, segment.criteria);
        }

        return customers;
    }

    _getVIPCustomers(customers) {
        // Use RFM analysis if available
        if (this.analyticsService) {
            const rfm = this.analyticsService.getRFMAnalysis();
            if (rfm.success) {
                const vipSegments = ['Champions', 'Loyal Customers'];
                const vipCustomers = rfm.rfm.customers.filter(c =>
                    vipSegments.includes(c.segment)
                );
                return customers.filter(c =>
                    vipCustomers.some(vc => vc.customerId === c.id)
                );
            }
        }

        // Fallback: customers with loyaltyPoints > 1000
        return customers.filter(c => (c.loyaltyPoints || 0) > 1000);
    }

    _getNewCustomers(customers) {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return customers.filter(c =>
            new Date(c.createdAt || 0) >= thirtyDaysAgo
        );
    }

    _getDormantCustomers(customers) {
        const sales = this.salesService.getAllSales();
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

        return customers.filter(customer => {
            const customerSales = sales.filter(s => s.customerId === customer.id);
            if (customerSales.length === 0) return true;

            const lastPurchase = new Date(Math.max(...customerSales.map(s => new Date(s.date))));
            return lastPurchase < ninetyDaysAgo;
        });
    }

    _filterBySegmentCriteria(customers, criteria) {
        // Simple criteria filtering
        return customers.filter(customer => {
            let matches = true;

            if (criteria.minLoyaltyPoints !== undefined) {
                matches = matches && (customer.loyaltyPoints || 0) >= criteria.minLoyaltyPoints;
            }

            if (criteria.city) {
                matches = matches && customer.city === criteria.city;
            }

            return matches;
        });
    }

    _simulateSend(campaign, recipients) {
        // Simulate realistic delivery rates
        const deliveryRate = 0.95 + Math.random() * 0.05; // 95-100%
        const openRate = 0.15 + Math.random() * 0.15; // 15-30%

        const sent = recipients.length;
        const delivered = Math.floor(sent * deliveryRate);
        const opened = Math.floor(delivered * openRate);

        // Simulate opening over time
        setTimeout(() => {
            campaign.stats.opened = opened;
            this._saveCampaigns();
        }, 5000);

        return {
            sent: sent,
            delivered: delivered
        };
    }

    _executeAutomation(automation, data) {
        // Execute automation (simulate sending)
        automation.stats.sent++;

        // Simulate conversion (10% conversion rate)
        if (Math.random() < 0.1) {
            automation.stats.converted++;
        }

        this._saveAutomations();
    }

    _scheduleCampaign(campaign) {
        const scheduledDate = new Date(campaign.scheduledDate);
        const now = new Date();
        const delay = scheduledDate - now;

        if (delay > 0) {
            setTimeout(() => {
                this.sendCampaign(campaign.id);
            }, delay);
        }
    }

    _calculateROI(campaign) {
        // Simplified ROI calculation
        const cost = 50; // Estimated campaign cost
        const revenue = campaign.stats.revenue;
        return revenue > 0 ? ((revenue - cost) / cost) * 100 : 0;
    }

    _getPerformanceGrade(openRate, clickRate, conversionRate) {
        const avgScore = (openRate + clickRate * 2 + conversionRate * 3) / 6;

        if (avgScore >= 20) return 'A+';
        if (avgScore >= 15) return 'A';
        if (avgScore >= 10) return 'B';
        if (avgScore >= 7) return 'C';
        return 'D';
    }

    _filterCampaignsByPeriod(campaigns, period) {
        const now = new Date();
        let startDate;

        if (period === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (period === 'quarter') {
            startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        }

        return campaigns.filter(c =>
            c.sentAt && new Date(c.sentAt) >= startDate
        );
    }

    _trackCampaignStats(campaignId, stats) {
        if (!this.campaignStats[campaignId]) {
            this.campaignStats[campaignId] = [];
        }

        this.campaignStats[campaignId].push({
            timestamp: new Date().toISOString(),
            ...stats
        });

        StorageService.set('campaignStats', this.campaignStats);
    }

    _getDefaultTemplates() {
        return {
            welcome: {
                subject: 'Добре дошли в {storeName}!',
                content: 'Здравейте {customerName},\n\nДобре дошли! Ето вашите 10% отстъпка с код: WELCOME10'
            },
            birthday: {
                subject: 'Честит рожден ден, {customerName}!',
                content: 'Честит рожден ден! Специално за вас - 20% отстъпка! Код: BDAY20'
            },
            abandoned_cart: {
                subject: 'Забравихте нещо в количката?',
                content: 'Здравейте {customerName},\n\nЗабелязахме че оставихте продукти в количката. Завършете поръчката си сега!'
            },
            winback: {
                subject: 'Липсвате ни, {customerName}!',
                content: 'Здравейте {customerName},\n\nДавно не сме ви виждали! Ето 15% отстъпка за следващата ви покупка. Код: COMEBACK15'
            }
        };
    }

    _saveCampaigns() {
        StorageService.set('marketingCampaigns', this.campaigns);
    }

    _saveSegments() {
        StorageService.set('customerSegments', this.segments);
    }

    _saveAutomations() {
        StorageService.set('marketingAutomations', this.automations);
    }
}
