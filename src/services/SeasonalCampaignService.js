import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

/**
 * SeasonalCampaignService - Автоматизация на сезонни и празнични кампании
 *
 * Функционалност:
 * - Pre-defined templates за популярни празници
 * - Automatic campaign activation по дата
 * - Bundle creation за празници
 * - Special pricing за събития
 * - Performance tracking по сезон
 * - Year-over-year comparison
 * - Automatic reminders за upcoming campaigns
 * - Event-based triggers
 *
 * v9.1 - Revenue Boost Suite Phase 2
 */
export class SeasonalCampaignService {
    constructor(productService, salesService, bundleService, flashSalesService) {
        this.productService = productService;
        this.salesService = salesService;
        this.bundleService = bundleService;
        this.flashSalesService = flashSalesService;

        this.campaigns = StorageService.load('seasonalCampaigns') || [];
        this.campaignTemplates = StorageService.load('campaignTemplates') || [];
        this.campaignPerformance = StorageService.load('campaignPerformance') || [];

        // Initialize default templates
        if (this.campaignTemplates.length === 0) {
            this._initializeDefaultTemplates();
        }

        // Check for upcoming campaigns
        this._checkUpcomingCampaigns();
    }

    /**
     * Инициализиране на default campaign templates за България
     */
    _initializeDefaultTemplates() {
        const templates = [
            {
                id: 'christmas',
                name: 'Коледа',
                icon: '🎄',
                month: 12,
                day: 25,
                durationDays: 14, // 2 weeks before
                recommendedDiscounts: { min: 15, max: 30 },
                categories: ['Хранителни стоки', 'Напитки', 'Сладкиши'],
                bundleIdeas: [
                    'Коледна трапеза',
                    'Коледни сладкиши',
                    'Празнична кошница'
                ],
                tags: ['holiday', 'family', 'gifts']
            },
            {
                id: 'new_year',
                name: 'Нова година',
                icon: '🎉',
                month: 1,
                day: 1,
                durationDays: 7,
                recommendedDiscounts: { min: 10, max: 25 },
                categories: ['Напитки', 'Закуски', 'Сладкиши'],
                bundleIdeas: [
                    'Новогодишна партита',
                    'Шампанско + закуски'
                ],
                tags: ['holiday', 'party', 'celebration']
            },
            {
                id: 'valentines',
                name: 'Свети Валентин',
                icon: '💝',
                month: 2,
                day: 14,
                durationDays: 7,
                recommendedDiscounts: { min: 15, max: 20 },
                categories: ['Сладкиши', 'Напитки'],
                bundleIdeas: [
                    'Романтична вечеря',
                    'Шоколад + вино'
                ],
                tags: ['holiday', 'romance', 'couples']
            },
            {
                id: 'womens_day',
                name: '8-ми Март',
                icon: '🌸',
                month: 3,
                day: 8,
                durationDays: 5,
                recommendedDiscounts: { min: 10, max: 20 },
                categories: ['Сладкиши', 'Напитки'],
                bundleIdeas: ['Подаръчна кошница'],
                tags: ['holiday', 'women', 'gifts']
            },
            {
                id: 'easter',
                name: 'Великден',
                icon: '🐰',
                month: 4, // varies - approximate
                day: 15,
                durationDays: 10,
                recommendedDiscounts: { min: 15, max: 25 },
                categories: ['Хранителни стоки', 'Яйца', 'Козунак'],
                bundleIdeas: [
                    'Великденска трапеза',
                    'Козунак + яйца'
                ],
                tags: ['holiday', 'family', 'tradition']
            },
            {
                id: 'labor_day',
                name: '1-ви Май',
                icon: '🌞',
                month: 5,
                day: 1,
                durationDays: 3,
                recommendedDiscounts: { min: 10, max: 15 },
                categories: ['Напитки', 'Закуски', 'Барбекю'],
                bundleIdeas: ['Пикник пакет', 'Барбекю комбо'],
                tags: ['holiday', 'outdoor', 'family']
            },
            {
                id: 'childrens_day',
                name: '1-ви Юни',
                icon: '👶',
                month: 6,
                day: 1,
                durationDays: 5,
                recommendedDiscounts: { min: 15, max: 20 },
                categories: ['Сладкиши', 'Напитки', 'Закуски'],
                bundleIdeas: ['Детско парти'],
                tags: ['holiday', 'children', 'family']
            },
            {
                id: 'black_friday',
                name: 'Черен петък',
                icon: '🛍️',
                month: 11,
                day: 25, // approximate - last Friday
                durationDays: 3,
                recommendedDiscounts: { min: 30, max: 50 },
                categories: ['Всички'],
                bundleIdeas: ['Мега deals', 'Flash sales'],
                tags: ['sale', 'discount', 'shopping']
            },
            {
                id: 'summer_sale',
                name: 'Лятна разпродажба',
                icon: '☀️',
                month: 7,
                day: 1,
                durationDays: 30,
                recommendedDiscounts: { min: 20, max: 40 },
                categories: ['Напитки', 'Сладолед', 'Лятно'],
                bundleIdeas: ['Лятно освежение'],
                tags: ['sale', 'summer', 'seasonal']
            },
            {
                id: 'back_to_school',
                name: 'Началото на учебната година',
                icon: '📚',
                month: 9,
                day: 15,
                durationDays: 14,
                recommendedDiscounts: { min: 10, max: 20 },
                categories: ['Хранителни стоки', 'Закуски'],
                bundleIdeas: ['Училищна кутия'],
                tags: ['school', 'children', 'seasonal']
            }
        ];

        this.campaignTemplates = templates;
        this._save();
    }

    /**
     * Създаване на campaign от template
     *
     * @param {string} templateId - ID на template
     * @param {number} year - година (default текуща)
     * @param {Object} customization - customization options
     */
    createCampaignFromTemplate(templateId, year = null, customization = {}) {
        const template = this.campaignTemplates.find(t => t.id === templateId);
        if (!template) {
            throw new Error('Campaign template не е намерен');
        }

        const currentYear = year || new Date().getFullYear();

        // Calculate campaign dates
        const campaignEndDate = new Date(currentYear, template.month - 1, template.day);
        const campaignStartDate = new Date(campaignEndDate);
        campaignStartDate.setDate(campaignStartDate.getDate() - template.durationDays);

        const campaign = {
            id: Date.now() + Math.random(),
            templateId: template.id,
            name: customization.name || template.name,
            icon: template.icon,
            year: currentYear,
            startDate: campaignStartDate.toISOString(),
            endDate: campaignEndDate.toISOString(),
            discountMin: customization.discountMin || template.recommendedDiscounts.min,
            discountMax: customization.discountMax || template.recommendedDiscounts.max,
            targetCategories: customization.categories || template.categories,
            bundleIdeas: template.bundleIdeas,
            tags: template.tags,
            status: 'scheduled', // scheduled, active, ended
            bundles: [],
            flashSales: [],
            promotions: [],
            stats: {
                revenue: 0,
                sales: 0,
                avgBasket: 0,
                customersReached: 0
            },
            createdAt: new Date().toISOString()
        };

        this.campaigns.push(campaign);
        this._save();

        return campaign;
    }

    /**
     * Автоматично създаване на campaigns за годината
     */
    autoCreateYearlyCampaigns(year = null) {
        const targetYear = year || new Date().getFullYear();
        const created = [];

        this.campaignTemplates.forEach(template => {
            // Check if campaign already exists
            const existing = this.campaigns.find(c =>
                c.templateId === template.id && c.year === targetYear
            );

            if (!existing) {
                try {
                    const campaign = this.createCampaignFromTemplate(template.id, targetYear);
                    created.push(campaign);
                } catch (error) {
                    console.error(`Error creating campaign for ${template.name}:`, error);
                }
            }
        });

        return {
            year: targetYear,
            created: created.length,
            campaigns: created
        };
    }

    /**
     * Добавяне на bundle към campaign
     */
    addBundleToCampaign(campaignId, bundleId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) {
            throw new Error('Campaign не е намерен');
        }

        if (!campaign.bundles.includes(bundleId)) {
            campaign.bundles.push(bundleId);
            this._save();
        }

        return campaign;
    }

    /**
     * Добавяне на flash sale към campaign
     */
    addFlashSaleToCampaign(campaignId, flashSaleId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) {
            throw new Error('Campaign не е намерен');
        }

        if (!campaign.flashSales.includes(flashSaleId)) {
            campaign.flashSales.push(flashSaleId);
            this._save();
        }

        return campaign;
    }

    /**
     * Получаване на активни campaigns
     */
    getActiveCampaigns() {
        const now = new Date();

        return this.campaigns.filter(campaign => {
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);

            return now >= startDate && now <= endDate;
        });
    }

    /**
     * Получаване на upcoming campaigns (следващите 30 дни)
     */
    getUpcomingCampaigns(daysAhead = 30) {
        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysAhead);

        return this.campaigns.filter(campaign => {
            const startDate = new Date(campaign.startDate);
            return startDate > now && startDate <= futureDate;
        }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    }

    /**
     * Проверка за upcoming campaigns и reminders
     */
    _checkUpcomingCampaigns() {
        const upcoming = this.getUpcomingCampaigns(14); // 2 weeks ahead

        const reminders = upcoming.map(campaign => {
            const daysUntil = Math.ceil(
                (new Date(campaign.startDate) - new Date()) / (1000 * 60 * 60 * 24)
            );

            return {
                campaign: campaign,
                daysUntil: daysUntil,
                message: `${campaign.icon} ${campaign.name} започва след ${daysUntil} дни!`,
                suggestions: this._getCampaignPreparationSuggestions(campaign)
            };
        });

        return reminders;
    }

    /**
     * Suggestions за подготовка на campaign
     */
    _getCampaignPreparationSuggestions(campaign) {
        const suggestions = [];

        // Bundle suggestions
        if (campaign.bundleIdeas.length > 0 && campaign.bundles.length === 0) {
            suggestions.push({
                type: 'create_bundles',
                priority: 'high',
                message: `Създайте bundles: ${campaign.bundleIdeas.join(', ')}`,
                action: 'create_bundles'
            });
        }

        // Flash sale suggestions
        if (campaign.flashSales.length === 0) {
            suggestions.push({
                type: 'create_flash_sales',
                priority: 'medium',
                message: 'Създайте flash sales за campaign периода',
                action: 'create_flash_sales'
            });
        }

        // Stock check
        suggestions.push({
            type: 'check_stock',
            priority: 'high',
            message: `Проверете stock за категории: ${campaign.targetCategories.join(', ')}`,
            action: 'check_stock'
        });

        // Marketing
        suggestions.push({
            type: 'marketing',
            priority: 'medium',
            message: 'Подгответе маркетинг материали (плакати, FB posts)',
            action: 'prepare_marketing'
        });

        return suggestions;
    }

    /**
     * Автоматично update на campaign statuses
     */
    updateCampaignStatuses() {
        const now = new Date();
        let updated = false;

        this.campaigns.forEach(campaign => {
            const startDate = new Date(campaign.startDate);
            const endDate = new Date(campaign.endDate);

            if (campaign.status === 'scheduled' && now >= startDate) {
                campaign.status = 'active';
                updated = true;
            }

            if (campaign.status === 'active' && now > endDate) {
                campaign.status = 'ended';
                campaign.endedAt = now.toISOString();

                // Archive performance
                this._archiveCampaignPerformance(campaign);
                updated = true;
            }
        });

        if (updated) {
            this._save();
        }

        return { updated };
    }

    /**
     * Tracking на campaign performance
     */
    trackCampaignSale(campaignId, saleId, saleData) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) return;

        campaign.stats.sales++;
        campaign.stats.revenue += saleData.total;
        campaign.stats.avgBasket = campaign.stats.revenue / campaign.stats.sales;

        if (saleData.customerId && !campaign.stats.customersReached) {
            campaign.stats.customersReached = new Set();
        }

        if (saleData.customerId) {
            campaign.stats.customersReached.add(saleData.customerId);
        }

        this._save();
    }

    /**
     * Archive campaign performance
     */
    _archiveCampaignPerformance(campaign) {
        const performance = {
            campaignId: campaign.id,
            templateId: campaign.templateId,
            name: campaign.name,
            year: campaign.year,
            startDate: campaign.startDate,
            endDate: campaign.endDate,
            stats: campaign.stats,
            customersReached: campaign.stats.customersReached
                ? campaign.stats.customersReached.size
                : 0,
            archivedAt: new Date().toISOString()
        };

        this.campaignPerformance.push(performance);
        this._save();
    }

    /**
     * Campaign performance report
     */
    getCampaignReport(campaignId) {
        const campaign = this.campaigns.find(c => c.id === campaignId);
        if (!campaign) {
            throw new Error('Campaign не е намерен');
        }

        const durationDays = Math.ceil(
            (new Date(campaign.endDate) - new Date(campaign.startDate)) / (1000 * 60 * 60 * 24)
        );

        return {
            campaign: campaign,
            duration: durationDays,
            revenue: campaign.stats.revenue,
            sales: campaign.stats.sales,
            avgBasket: campaign.stats.avgBasket,
            revenuePerDay: campaign.stats.revenue / durationDays,
            salesPerDay: campaign.stats.sales / durationDays,
            customersReached: campaign.stats.customersReached
                ? campaign.stats.customersReached.size
                : 0,
            bundlesUsed: campaign.bundles.length,
            flashSalesUsed: campaign.flashSales.length
        };
    }

    /**
     * Year-over-year comparison
     */
    compareYearOverYear(templateId, year1, year2) {
        const campaign1 = this.campaignPerformance.find(c =>
            c.templateId === templateId && c.year === year1
        ) || this.campaigns.find(c =>
            c.templateId === templateId && c.year === year1
        );

        const campaign2 = this.campaignPerformance.find(c =>
            c.templateId === templateId && c.year === year2
        ) || this.campaigns.find(c =>
            c.templateId === templateId && c.year === year2
        );

        if (!campaign1 || !campaign2) {
            throw new Error('Campaigns не са намерени за сравнение');
        }

        const revenue1 = campaign1.stats.revenue;
        const revenue2 = campaign2.stats.revenue;
        const revenueGrowth = revenue1 > 0
            ? ((revenue2 - revenue1) / revenue1 * 100)
            : 0;

        const sales1 = campaign1.stats.sales;
        const sales2 = campaign2.stats.sales;
        const salesGrowth = sales1 > 0
            ? ((sales2 - sales1) / sales1 * 100)
            : 0;

        return {
            templateId: templateId,
            year1: year1,
            year2: year2,
            revenue: {
                year1: revenue1,
                year2: revenue2,
                growth: revenueGrowth.toFixed(1),
                trend: revenueGrowth > 0 ? 'up' : 'down'
            },
            sales: {
                year1: sales1,
                year2: sales2,
                growth: salesGrowth.toFixed(1),
                trend: salesGrowth > 0 ? 'up' : 'down'
            },
            avgBasket: {
                year1: campaign1.stats.avgBasket,
                year2: campaign2.stats.avgBasket,
                change: (campaign2.stats.avgBasket - campaign1.stats.avgBasket).toFixed(2)
            }
        };
    }

    /**
     * Overall seasonal performance report
     */
    getSeasonalPerformanceReport(year = null) {
        const targetYear = year || new Date().getFullYear();

        const yearCampaigns = this.campaigns.filter(c => c.year === targetYear);
        const yearPerformance = this.campaignPerformance.filter(c => c.year === targetYear);

        const allCampaigns = [...yearCampaigns, ...yearPerformance];

        const totalRevenue = allCampaigns.reduce((sum, c) => sum + (c.stats?.revenue || 0), 0);
        const totalSales = allCampaigns.reduce((sum, c) => sum + (c.stats?.sales || 0), 0);

        const campaignBreakdown = allCampaigns.map(c => ({
            name: c.name,
            revenue: c.stats?.revenue || 0,
            sales: c.stats?.sales || 0,
            status: c.status
        })).sort((a, b) => b.revenue - a.revenue);

        const topPerformer = campaignBreakdown.length > 0 ? campaignBreakdown[0] : null;

        return {
            year: targetYear,
            totalCampaigns: allCampaigns.length,
            totalRevenue: totalRevenue,
            totalSales: totalSales,
            avgRevenuePerCampaign: allCampaigns.length > 0
                ? totalRevenue / allCampaigns.length
                : 0,
            topPerformer: topPerformer,
            campaignBreakdown: campaignBreakdown
        };
    }

    _save() {
        StorageService.save('seasonalCampaigns', this.campaigns);
        StorageService.save('campaignTemplates', this.campaignTemplates);
        StorageService.save('campaignPerformance', this.campaignPerformance);
    }
}
