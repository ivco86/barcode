/**
 * Employee Performance Analytics Service - v5.0
 * Comprehensive employee tracking, KPIs, and performance management
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class EmployeePerformanceService {
    constructor(salesService, authService, gamificationService) {
        this.salesService = salesService;
        this.authService = authService;
        this.gamificationService = gamificationService;

        this.performanceGoals = StorageService.get('employeeGoals', {});
        this.performanceReviews = StorageService.get('performanceReviews', []);
        this.customerRatings = StorageService.get('customerRatings', []);
        this.incentiveRules = StorageService.get('incentiveRules', this._getDefaultIncentiveRules());
    }

    /**
     * Get comprehensive employee performance metrics
     * @param {number} userId - User/Employee ID
     * @param {string} period - Period ('today', 'week', 'month', 'quarter', 'year')
     * @returns {Object} Performance metrics
     */
    getEmployeePerformance(userId, period = 'month') {
        const user = this.authService.getUserById(userId);

        if (!user) {
            return {
                success: false,
                errors: ['Служителят не съществува']
            };
        }

        const sales = this._getEmployeeSales(userId, period);

        if (sales.length === 0) {
            return {
                success: true,
                performance: {
                    userId: userId,
                    userName: user.name,
                    period: period,
                    salesCount: 0,
                    revenue: 0,
                    message: 'Няма продажби за избрания период'
                }
            };
        }

        // Calculate core metrics
        const metrics = this._calculateCoreMetrics(sales);

        // Calculate advanced metrics
        const avgTransactionTime = this._calculateAvgTransactionTime(sales);
        const itemsPerSale = this._calculateItemsPerSale(sales);
        const upsellRate = this._calculateUpsellRate(sales);
        const customerSatisfaction = this._getCustomerSatisfaction(userId, period);

        // Get goals and calculate achievement
        const goals = this.performanceGoals[userId] || {};
        const goalsAchievement = this._calculateGoalsAchievement(metrics, goals);

        // Calculate ranking among peers
        const ranking = this._calculatePeerRanking(userId, period, metrics.revenue);

        // Calculate bonus
        const bonus = this._calculateBonus(userId, metrics, goalsAchievement);

        return {
            success: true,
            performance: {
                userId: userId,
                userName: user.name,
                period: period,

                // Core metrics
                salesCount: metrics.salesCount,
                revenue: Math.round(metrics.revenue * 100) / 100,
                avgSaleValue: Math.round(metrics.avgSaleValue * 100) / 100,

                // Time metrics
                avgTransactionTime: avgTransactionTime,
                totalHoursWorked: this._estimateHoursWorked(sales),
                salesPerHour: Math.round((metrics.salesCount / this._estimateHoursWorked(sales)) * 10) / 10,

                // Product metrics
                avgItemsPerSale: Math.round(itemsPerSale * 10) / 10,
                totalItemsSold: metrics.totalItems,
                uniqueProductsSold: metrics.uniqueProducts,

                // Performance indicators
                upsellRate: Math.round(upsellRate * 100),
                upsellEffectiveness: upsellRate > 0.3 ? 'excellent' : upsellRate > 0.15 ? 'good' : 'needs improvement',

                // Customer satisfaction
                avgCustomerRating: customerSatisfaction.avgRating,
                totalRatings: customerSatisfaction.totalRatings,
                satisfactionLevel: customerSatisfaction.level,

                // Goals
                goalsSet: Object.keys(goals).length,
                goalsAchieved: goalsAchievement.achieved,
                goalsProgress: goalsAchievement.progress,

                // Ranking
                rank: ranking.rank,
                totalEmployees: ranking.total,
                percentile: ranking.percentile,

                // Rewards
                estimatedBonus: Math.round(bonus * 100) / 100,
                gamificationLevel: this._getGamificationLevel(userId),

                // Performance score (0-100)
                performanceScore: this._calculateOverallScore(metrics, upsellRate, customerSatisfaction, goalsAchievement),
                grade: this._getPerformanceGrade(this._calculateOverallScore(metrics, upsellRate, customerSatisfaction, goalsAchievement))
            }
        };
    }

    /**
     * Set performance goals for employee
     * @param {number} userId - User ID
     * @param {Object} goals - Goals to set
     * @returns {Object} Result
     */
    setPerformanceGoals(userId, goals) {
        const validation = this._validateGoals(goals);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        this.performanceGoals[userId] = {
            ...goals,
            setDate: new Date().toISOString(),
            period: goals.period || 'month'
        };

        this._saveGoals();

        return {
            success: true,
            goals: this.performanceGoals[userId]
        };
    }

    /**
     * Get leaderboard of employees
     * @param {string} period - Period
     * @param {string} metric - Metric to rank by ('revenue', 'sales', 'satisfaction')
     * @param {number} limit - Number of top employees
     * @returns {Object} Leaderboard
     */
    getLeaderboard(period = 'month', metric = 'revenue', limit = 10) {
        const allUsers = this.authService.getAllUsers() || [];
        const leaderboard = [];

        allUsers.forEach(user => {
            const performance = this.getEmployeePerformance(user.id, period);

            if (performance.success && performance.performance.salesCount > 0) {
                let score = 0;

                if (metric === 'revenue') {
                    score = performance.performance.revenue;
                } else if (metric === 'sales') {
                    score = performance.performance.salesCount;
                } else if (metric === 'satisfaction') {
                    score = performance.performance.avgCustomerRating;
                } else if (metric === 'score') {
                    score = performance.performance.performanceScore;
                }

                leaderboard.push({
                    userId: user.id,
                    userName: user.name,
                    score: Math.round(score * 100) / 100,
                    salesCount: performance.performance.salesCount,
                    revenue: performance.performance.revenue,
                    rating: performance.performance.avgCustomerRating,
                    performanceScore: performance.performance.performanceScore,
                    grade: performance.performance.grade
                });
            }
        });

        // Sort by score
        leaderboard.sort((a, b) => b.score - a.score);

        // Assign ranks
        const rankedLeaderboard = leaderboard.slice(0, limit).map((entry, index) => ({
            rank: index + 1,
            ...entry,
            badge: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''
        }));

        return {
            success: true,
            leaderboard: {
                period: period,
                metric: metric,
                entries: rankedLeaderboard,
                totalEmployees: leaderboard.length
            }
        };
    }

    /**
     * Create performance review
     * @param {number} userId - User ID
     * @param {Object} reviewData - Review data
     * @returns {Object} Result
     */
    createPerformanceReview(userId, reviewData) {
        const user = this.authService.getUserById(userId);

        if (!user) {
            return {
                success: false,
                errors: ['Служителят не съществува']
            };
        }

        const performance = this.getEmployeePerformance(userId, reviewData.period || 'month');

        const review = {
            id: Date.now(),
            userId: userId,
            userName: user.name,
            period: reviewData.period || 'month',
            reviewDate: new Date().toISOString(),
            reviewerId: reviewData.reviewerId,

            // Auto-generated metrics
            metrics: performance.success ? performance.performance : {},

            // Manual feedback
            strengths: ValidationService.sanitizeString(reviewData.strengths || ''),
            areasForImprovement: ValidationService.sanitizeString(reviewData.areasForImprovement || ''),
            goals: reviewData.goals || [],
            rating: reviewData.rating || 0, // 1-5
            notes: ValidationService.sanitizeString(reviewData.notes || '')
        };

        this.performanceReviews.push(review);
        this._saveReviews();

        return {
            success: true,
            review: review
        };
    }

    /**
     * Add customer rating for employee
     * @param {number} userId - User ID
     * @param {number} saleId - Sale ID
     * @param {number} rating - Rating (1-5)
     * @param {string} feedback - Customer feedback
     * @returns {Object} Result
     */
    addCustomerRating(userId, saleId, rating, feedback = '') {
        const ratingValidation = ValidationService.validateNumber(rating, 'Оценка', 1, 5);
        if (!ratingValidation.isValid) {
            return { success: false, errors: ratingValidation.errors };
        }

        const customerRating = {
            id: Date.now(),
            userId: userId,
            saleId: saleId,
            rating: ratingValidation.value,
            feedback: ValidationService.sanitizeString(feedback),
            timestamp: new Date().toISOString()
        };

        this.customerRatings.push(customerRating);
        this._saveRatings();

        return {
            success: true,
            rating: customerRating
        };
    }

    /**
     * Calculate team performance
     * @param {string} period - Period
     * @returns {Object} Team metrics
     */
    getTeamPerformance(period = 'month') {
        const allUsers = this.authService.getAllUsers() || [];
        const teamMetrics = [];
        let totalRevenue = 0;
        let totalSales = 0;
        let totalRatings = 0;
        let ratingSum = 0;

        allUsers.forEach(user => {
            const performance = this.getEmployeePerformance(user.id, period);

            if (performance.success && performance.performance.salesCount > 0) {
                teamMetrics.push(performance.performance);
                totalRevenue += performance.performance.revenue;
                totalSales += performance.performance.salesCount;

                if (performance.performance.totalRatings > 0) {
                    totalRatings += performance.performance.totalRatings;
                    ratingSum += performance.performance.avgCustomerRating * performance.performance.totalRatings;
                }
            }
        });

        return {
            success: true,
            team: {
                period: period,
                activeEmployees: teamMetrics.length,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                totalSales: totalSales,
                avgRevenuePerEmployee: teamMetrics.length > 0 ? Math.round((totalRevenue / teamMetrics.length) * 100) / 100 : 0,
                avgSalesPerEmployee: teamMetrics.length > 0 ? Math.round(totalSales / teamMetrics.length) : 0,
                avgCustomerRating: totalRatings > 0 ? Math.round((ratingSum / totalRatings) * 10) / 10 : 0,
                topPerformer: teamMetrics.length > 0 ? teamMetrics.reduce((top, emp) =>
                    emp.revenue > (top.revenue || 0) ? emp : top
                ) : null,
                employees: teamMetrics
            }
        };
    }

    /**
     * Update incentive rules
     * @param {Object} rules - Incentive rules
     * @returns {Object} Result
     */
    updateIncentiveRules(rules) {
        this.incentiveRules = { ...this.incentiveRules, ...rules };
        StorageService.set('incentiveRules', this.incentiveRules);

        return {
            success: true,
            rules: this.incentiveRules
        };
    }

    // ============ PRIVATE METHODS ============

    _getEmployeeSales(userId, period) {
        const allSales = this.salesService.getAllSales();
        const periodSales = this._filterByPeriod(allSales, period);

        return periodSales.filter(sale => sale.userId === userId);
    }

    _filterByPeriod(sales, period) {
        const now = new Date();
        let startDate;

        if (period === 'today') {
            startDate = new Date(now.toISOString().split('T')[0]);
        } else if (period === 'week') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        } else if (period === 'quarter') {
            startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        } else if (period === 'year') {
            startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        }

        return sales.filter(sale => new Date(sale.date) >= startDate);
    }

    _calculateCoreMetrics(sales) {
        const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
        const salesCount = sales.length;
        const avgSaleValue = salesCount > 0 ? revenue / salesCount : 0;

        const allItems = sales.flatMap(sale => sale.items);
        const totalItems = allItems.reduce((sum, item) => sum + item.quantity, 0);
        const uniqueProducts = new Set(allItems.map(item => item.productId)).size;

        return {
            revenue,
            salesCount,
            avgSaleValue,
            totalItems,
            uniqueProducts
        };
    }

    _calculateAvgTransactionTime(sales) {
        if (sales.length < 2) return '0:00';

        let totalTime = 0;
        for (let i = 1; i < sales.length; i++) {
            const prevTime = new Date(sales[i - 1].date);
            const currTime = new Date(sales[i].date);
            const diff = (currTime - prevTime) / 1000 / 60; // minutes

            if (diff < 30) { // Only count if less than 30 minutes (likely same shift)
                totalTime += diff;
            }
        }

        const avgMinutes = totalTime / (sales.length - 1);
        const minutes = Math.floor(avgMinutes);
        const seconds = Math.floor((avgMinutes - minutes) * 60);

        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    _calculateItemsPerSale(sales) {
        const totalItems = sales.reduce((sum, sale) =>
            sum + sale.items.reduce((s, item) => s + item.quantity, 0), 0
        );
        return sales.length > 0 ? totalItems / sales.length : 0;
    }

    _calculateUpsellRate(sales) {
        // Upselling = sales with 3+ items or total > 50
        const upsells = sales.filter(sale => {
            const itemCount = sale.items.reduce((sum, item) => sum + item.quantity, 0);
            return itemCount >= 3 || sale.total > 50;
        });

        return sales.length > 0 ? upsells.length / sales.length : 0;
    }

    _getCustomerSatisfaction(userId, period) {
        const periodRatings = this.customerRatings.filter(rating => {
            const ratingDate = new Date(rating.timestamp);
            const isCorrectUser = rating.userId === userId;

            // Simple period filter
            if (period === 'today') {
                return isCorrectUser && ratingDate.toDateString() === new Date().toDateString();
            } else if (period === 'week') {
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                return isCorrectUser && ratingDate >= weekAgo;
            } else {
                const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
                return isCorrectUser && ratingDate >= monthAgo;
            }
        });

        const avgRating = periodRatings.length > 0 ?
                         periodRatings.reduce((sum, r) => sum + r.rating, 0) / periodRatings.length : 0;

        let level = 'none';
        if (avgRating >= 4.5) level = 'excellent';
        else if (avgRating >= 4.0) level = 'very good';
        else if (avgRating >= 3.5) level = 'good';
        else if (avgRating >= 3.0) level = 'satisfactory';
        else if (avgRating > 0) level = 'needs improvement';

        return {
            avgRating: Math.round(avgRating * 10) / 10,
            totalRatings: periodRatings.length,
            level: level
        };
    }

    _estimateHoursWorked(sales) {
        if (sales.length === 0) return 0;

        // Group by day
        const dayGroups = {};
        sales.forEach(sale => {
            const day = new Date(sale.date).toISOString().split('T')[0];
            if (!dayGroups[day]) {
                dayGroups[day] = [];
            }
            dayGroups[day].push(new Date(sale.date));
        });

        // Estimate hours per day (first to last sale + 1 hour buffer)
        let totalHours = 0;
        Object.values(dayGroups).forEach(times => {
            if (times.length > 0) {
                times.sort((a, b) => a - b);
                const dayHours = (times[times.length - 1] - times[0]) / (1000 * 60 * 60) + 1;
                totalHours += Math.min(dayHours, 12); // Cap at 12 hours per day
            }
        });

        return Math.round(totalHours * 10) / 10;
    }

    _calculateGoalsAchievement(metrics, goals) {
        const achievements = {};
        let achieved = 0;
        let total = Object.keys(goals).length;

        Object.keys(goals).forEach(goalKey => {
            if (goalKey === 'setDate' || goalKey === 'period') {
                total--;
                return;
            }

            const goalValue = goals[goalKey];
            const actualValue = metrics[goalKey] || 0;
            const percentage = goalValue > 0 ? (actualValue / goalValue) * 100 : 0;

            achievements[goalKey] = {
                goal: goalValue,
                actual: actualValue,
                percentage: Math.round(percentage),
                achieved: actualValue >= goalValue
            };

            if (actualValue >= goalValue) achieved++;
        });

        return {
            achievements: achievements,
            achieved: achieved,
            total: total,
            progress: total > 0 ? Math.round((achieved / total) * 100) : 0
        };
    }

    _calculatePeerRanking(userId, period, revenue) {
        const allUsers = this.authService.getAllUsers() || [];
        const rankings = [];

        allUsers.forEach(user => {
            const performance = this.getEmployeePerformance(user.id, period);
            if (performance.success && performance.performance.salesCount > 0) {
                rankings.push({
                    userId: user.id,
                    revenue: performance.performance.revenue
                });
            }
        });

        rankings.sort((a, b) => b.revenue - a.revenue);

        const rank = rankings.findIndex(r => r.userId === userId) + 1;
        const percentile = rankings.length > 0 ? Math.round((1 - (rank - 1) / rankings.length) * 100) : 0;

        return {
            rank: rank || rankings.length + 1,
            total: rankings.length,
            percentile: percentile
        };
    }

    _calculateBonus(userId, metrics, goalsAchievement) {
        const rules = this.incentiveRules;

        let bonus = 0;

        // Revenue-based bonus
        if (metrics.revenue >= rules.revenueTier3) {
            bonus += rules.bonusTier3;
        } else if (metrics.revenue >= rules.revenueTier2) {
            bonus += rules.bonusTier2;
        } else if (metrics.revenue >= rules.revenueTier1) {
            bonus += rules.bonusTier1;
        }

        // Goals achievement bonus
        if (goalsAchievement.progress >= 100) {
            bonus += rules.goalsBonus;
        } else if (goalsAchievement.progress >= 75) {
            bonus += rules.goalsBonus * 0.5;
        }

        return bonus;
    }

    _getGamificationLevel(userId) {
        if (this.gamificationService) {
            const profile = this.gamificationService.getUserProfile(userId);
            return profile.success ? profile.profile.level : 1;
        }
        return 1;
    }

    _calculateOverallScore(metrics, upsellRate, customerSatisfaction, goalsAchievement) {
        // Weighted score calculation
        const revenueScore = Math.min(100, (metrics.revenue / 1000) * 20); // 20 points per 1000
        const salesScore = Math.min(100, metrics.salesCount * 2); // 2 points per sale
        const upsellScore = upsellRate * 100; // 0-100
        const satisfactionScore = (customerSatisfaction.avgRating / 5) * 100;
        const goalsScore = goalsAchievement.progress;

        const totalScore = (
            revenueScore * 0.3 +
            salesScore * 0.2 +
            upsellScore * 0.2 +
            satisfactionScore * 0.2 +
            goalsScore * 0.1
        );

        return Math.round(Math.min(100, totalScore));
    }

    _getPerformanceGrade(score) {
        if (score >= 90) return 'A+';
        if (score >= 85) return 'A';
        if (score >= 80) return 'B+';
        if (score >= 75) return 'B';
        if (score >= 70) return 'C+';
        if (score >= 65) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    _validateGoals(goals) {
        const errors = [];

        if (!goals || typeof goals !== 'object') {
            errors.push('Невалидни цели');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    _getDefaultIncentiveRules() {
        return {
            revenueTier1: 1000,
            bonusTier1: 50,
            revenueTier2: 2500,
            bonusTier2: 150,
            revenueTier3: 5000,
            bonusTier3: 300,
            goalsBonus: 100
        };
    }

    _saveGoals() {
        StorageService.set('employeeGoals', this.performanceGoals);
    }

    _saveReviews() {
        StorageService.set('performanceReviews', this.performanceReviews);
    }

    _saveRatings() {
        StorageService.set('customerRatings', this.customerRatings);
    }
}
