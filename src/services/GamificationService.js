/**
 * Gamification Service - v4.0
 * Challenges, achievements, leaderboards, and rewards
 */
import { ValidationService } from './ValidationService.js';
import { StorageService } from './StorageService.js';

export class GamificationService {
    constructor(salesService, authService) {
        this.salesService = salesService;
        this.authService = authService;

        this.achievements = this._loadAchievements();
        this.userProgress = StorageService.get('gamificationProgress', {});
        this.challenges = this._loadChallenges();
        this.badges = this._initializeBadges();
    }

    /**
     * Get user gamification profile
     * @param {number} userId - User ID
     * @returns {Object} User profile with stats, achievements, badges
     */
    getUserProfile(userId) {
        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
            this._saveProgress();
        }

        const profile = this.userProgress[userId];
        const user = this.authService.getUserById(userId);

        return {
            success: true,
            profile: {
                userId: userId,
                userName: user ? user.name : 'Неизвестен',
                level: profile.level,
                experiencePoints: profile.xp,
                xpToNextLevel: this._calculateXPForNextLevel(profile.level),
                totalPoints: profile.totalPoints,
                badges: profile.badges,
                achievements: profile.achievements,
                currentChallenges: profile.currentChallenges,
                stats: profile.stats
            }
        };
    }

    /**
     * Award experience points to user
     * @param {number} userId - User ID
     * @param {number} xp - Experience points to award
     * @param {string} reason - Reason for XP
     * @returns {Object} Result with level up info
     */
    awardExperience(userId, xp, reason = '') {
        const validation = ValidationService.validateNumber(xp, 'XP', 0, 10000);
        if (!validation.isValid) {
            return { success: false, errors: validation.errors };
        }

        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
        }

        const profile = this.userProgress[userId];
        const oldLevel = profile.level;
        profile.xp += validation.value;
        profile.totalPoints += validation.value;

        // Check for level up
        const levelUps = [];
        while (profile.xp >= this._calculateXPForNextLevel(profile.level)) {
            profile.xp -= this._calculateXPForNextLevel(profile.level);
            profile.level++;
            levelUps.push(profile.level);

            // Award level up badge
            this._awardBadge(userId, `level_${profile.level}`, `Достигна ниво ${profile.level}`);
        }

        // Log XP gain
        if (!profile.xpHistory) {
            profile.xpHistory = [];
        }
        profile.xpHistory.push({
            xp: validation.value,
            reason: reason,
            timestamp: new Date().toISOString()
        });

        this._saveProgress();

        return {
            success: true,
            reward: {
                xpAwarded: validation.value,
                reason: reason,
                oldLevel: oldLevel,
                newLevel: profile.level,
                leveledUp: levelUps.length > 0,
                levelsGained: levelUps,
                currentXP: profile.xp,
                xpToNextLevel: this._calculateXPForNextLevel(profile.level)
            }
        };
    }

    /**
     * Award badge to user
     * @param {number} userId - User ID
     * @param {string} badgeId - Badge ID
     * @param {string} reason - Reason for badge
     * @returns {Object} Result
     */
    awardBadge(userId, badgeId, reason = '') {
        return this._awardBadge(userId, badgeId, reason);
    }

    /**
     * Check and update achievements for user
     * @param {number} userId - User ID
     * @returns {Object} Newly unlocked achievements
     */
    checkAchievements(userId) {
        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
        }

        const profile = this.userProgress[userId];
        const newAchievements = [];

        // Get user sales
        const userSales = this.salesService.getAllSales().filter(s => s.userId === userId);

        // Check each achievement
        Object.keys(this.achievements).forEach(achievementId => {
            // Skip if already unlocked
            if (profile.achievements.includes(achievementId)) {
                return;
            }

            const achievement = this.achievements[achievementId];
            let unlocked = false;

            switch (achievement.type) {
                case 'sales_count':
                    unlocked = userSales.length >= achievement.target;
                    break;

                case 'sales_value':
                    const totalValue = userSales.reduce((sum, s) => sum + s.total, 0);
                    unlocked = totalValue >= achievement.target;
                    break;

                case 'sales_streak':
                    const streak = this._calculateSalesStreak(userSales);
                    unlocked = streak >= achievement.target;
                    break;

                case 'perfect_day':
                    unlocked = this._checkPerfectDay(userId);
                    break;

                case 'speed_demon':
                    unlocked = this._checkSpeedDemon(userSales);
                    break;

                case 'customer_champion':
                    const uniqueCustomers = new Set(userSales.map(s => s.customerId)).size;
                    unlocked = uniqueCustomers >= achievement.target;
                    break;

                default:
                    break;
            }

            if (unlocked) {
                profile.achievements.push(achievementId);
                newAchievements.push(achievement);

                // Award XP for achievement
                this.awardExperience(userId, achievement.xpReward, `Постижение: ${achievement.name}`);

                // Award badge if specified
                if (achievement.badgeId) {
                    this._awardBadge(userId, achievement.badgeId, achievement.name);
                }
            }
        });

        this._saveProgress();

        return {
            success: true,
            newAchievements: newAchievements,
            totalAchievements: profile.achievements.length,
            totalPossible: Object.keys(this.achievements).length
        };
    }

    /**
     * Create or update daily challenge for user
     * @param {number} userId - User ID
     * @returns {Object} Today's challenge
     */
    getDailyChallenge(userId) {
        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
        }

        const profile = this.userProgress[userId];
        const today = new Date().toISOString().split('T')[0];

        // Check if we need a new challenge
        if (!profile.dailyChallenge || profile.dailyChallenge.date !== today) {
            // Generate new daily challenge
            const challengeTypes = [
                {
                    type: 'sales_target',
                    name: 'Дневна Цел',
                    description: 'Направи 10 продажби днес',
                    target: 10,
                    progress: 0,
                    xpReward: 100
                },
                {
                    type: 'revenue_target',
                    name: 'Генератор на Приходи',
                    description: 'Генерирай 500 лв приходи днес',
                    target: 500,
                    progress: 0,
                    xpReward: 150
                },
                {
                    type: 'speed_challenge',
                    name: 'Бърза Каса',
                    description: 'Направи 5 продажби под 2 минути',
                    target: 5,
                    progress: 0,
                    xpReward: 120
                },
                {
                    type: 'perfect_accuracy',
                    name: 'Перфектна Точност',
                    description: 'Направи 10 продажби без грешки',
                    target: 10,
                    progress: 0,
                    xpReward: 130
                }
            ];

            const randomChallenge = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
            profile.dailyChallenge = {
                ...randomChallenge,
                date: today,
                completed: false
            };

            this._saveProgress();
        }

        // Update progress
        this._updateDailyChallengeProgress(userId);

        return {
            success: true,
            challenge: profile.dailyChallenge
        };
    }

    /**
     * Get leaderboard
     * @param {string} period - 'today', 'week', 'month', 'alltime'
     * @param {string} metric - 'xp', 'sales', 'revenue'
     * @param {number} limit - Number of entries
     * @returns {Object} Leaderboard
     */
    getLeaderboard(period = 'alltime', metric = 'xp', limit = 10) {
        const allUsers = Object.keys(this.userProgress).map(userId => {
            const profile = this.userProgress[userId];
            const user = this.authService.getUserById(parseInt(userId));

            let score = 0;
            let additionalInfo = {};

            if (metric === 'xp') {
                score = profile.totalPoints;
                additionalInfo = { level: profile.level };
            } else if (metric === 'sales') {
                const userSales = this._getUserSalesInPeriod(parseInt(userId), period);
                score = userSales.length;
                additionalInfo = { sales: userSales.length };
            } else if (metric === 'revenue') {
                const userSales = this._getUserSalesInPeriod(parseInt(userId), period);
                score = userSales.reduce((sum, s) => sum + s.total, 0);
                additionalInfo = { revenue: score };
            }

            return {
                userId: parseInt(userId),
                userName: user ? user.name : 'Неизвестен',
                score: score,
                level: profile.level,
                badges: profile.badges.length,
                ...additionalInfo
            };
        });

        // Sort by score
        allUsers.sort((a, b) => b.score - a.score);

        // Assign ranks
        const leaderboard = allUsers.slice(0, limit).map((entry, index) => ({
            rank: index + 1,
            ...entry
        }));

        return {
            success: true,
            leaderboard: {
                period: period,
                metric: metric,
                entries: leaderboard,
                totalPlayers: allUsers.length
            }
        };
    }

    /**
     * Get all available badges
     * @returns {Object} Badges list
     */
    getAllBadges() {
        return {
            success: true,
            badges: this.badges
        };
    }

    /**
     * Get user badges
     * @param {number} userId - User ID
     * @returns {Object} User's badges
     */
    getUserBadges(userId) {
        if (!this.userProgress[userId]) {
            return {
                success: true,
                badges: [],
                totalBadges: 0
            };
        }

        const profile = this.userProgress[userId];
        const userBadges = profile.badges.map(badgeId => {
            const badge = this.badges.find(b => b.id === badgeId);
            return badge || null;
        }).filter(b => b !== null);

        return {
            success: true,
            badges: userBadges,
            totalBadges: userBadges.length,
            totalPossible: this.badges.length
        };
    }

    /**
     * Record sale event for gamification
     * @param {number} userId - User ID
     * @param {Object} sale - Sale object
     */
    recordSaleEvent(userId, sale) {
        // Award XP for sale
        const baseXP = 10;
        const bonusXP = Math.floor(sale.total / 10); // 1 XP per 10 лв
        const totalXP = baseXP + bonusXP;

        this.awardExperience(userId, totalXP, 'Продажба');

        // Update stats
        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
        }

        const profile = this.userProgress[userId];
        profile.stats.totalSales++;
        profile.stats.totalRevenue += sale.total;
        profile.stats.lastSaleDate = new Date().toISOString();

        // Check achievements
        this.checkAchievements(userId);

        // Update daily challenge
        this._updateDailyChallengeProgress(userId);

        this._saveProgress();

        return { success: true };
    }

    // ============ PRIVATE METHODS ============

    _createUserProfile(userId) {
        return {
            userId: userId,
            level: 1,
            xp: 0,
            totalPoints: 0,
            badges: [],
            achievements: [],
            currentChallenges: [],
            dailyChallenge: null,
            stats: {
                totalSales: 0,
                totalRevenue: 0,
                perfectDays: 0,
                salesStreak: 0,
                lastSaleDate: null
            },
            xpHistory: []
        };
    }

    _calculateXPForNextLevel(currentLevel) {
        // XP required = 100 * level^1.5
        return Math.floor(100 * Math.pow(currentLevel, 1.5));
    }

    _awardBadge(userId, badgeId, reason) {
        if (!this.userProgress[userId]) {
            this.userProgress[userId] = this._createUserProfile(userId);
        }

        const profile = this.userProgress[userId];

        // Check if already has badge
        if (profile.badges.includes(badgeId)) {
            return {
                success: false,
                errors: ['Вече има този бадж']
            };
        }

        profile.badges.push(badgeId);

        const badge = this.badges.find(b => b.id === badgeId);

        this._saveProgress();

        return {
            success: true,
            badge: badge || { id: badgeId, name: badgeId, description: reason }
        };
    }

    _loadAchievements() {
        return {
            'first_sale': {
                id: 'first_sale',
                name: 'Първа Продажба',
                description: 'Направи първата си продажба',
                type: 'sales_count',
                target: 1,
                xpReward: 50,
                badgeId: 'newcomer'
            },
            'sales_10': {
                id: 'sales_10',
                name: 'Професионалист',
                description: 'Направи 10 продажби',
                type: 'sales_count',
                target: 10,
                xpReward: 100,
                badgeId: 'pro_seller'
            },
            'sales_100': {
                id: 'sales_100',
                name: 'Майстор',
                description: 'Направи 100 продажби',
                type: 'sales_count',
                target: 100,
                xpReward: 500,
                badgeId: 'master_seller'
            },
            'revenue_1000': {
                id: 'revenue_1000',
                name: 'Златна Каса',
                description: 'Генерирай 1000 лв общо',
                type: 'sales_value',
                target: 1000,
                xpReward: 200,
                badgeId: 'golden_cashier'
            },
            'revenue_10000': {
                id: 'revenue_10000',
                name: 'Диамантена Каса',
                description: 'Генерирай 10000 лв общо',
                type: 'sales_value',
                target: 10000,
                xpReward: 1000,
                badgeId: 'diamond_cashier'
            },
            'sales_streak_7': {
                id: 'sales_streak_7',
                name: 'Седмична Серия',
                description: 'Продавай 7 дни подред',
                type: 'sales_streak',
                target: 7,
                xpReward: 300,
                badgeId: 'streak_master'
            },
            'perfect_day': {
                id: 'perfect_day',
                name: 'Перфектен Ден',
                description: 'Направи 20+ продажби за един ден',
                type: 'perfect_day',
                target: 20,
                xpReward: 150,
                badgeId: 'perfect_day'
            },
            'speed_demon': {
                id: 'speed_demon',
                name: 'Бърза Каса',
                description: 'Направи 10 продажби под 1 минута',
                type: 'speed_demon',
                target: 10,
                xpReward: 200,
                badgeId: 'speed_demon'
            },
            'customer_champion': {
                id: 'customer_champion',
                name: 'Шампион на Клиентите',
                description: 'Обслужи 50 различни клиенти',
                type: 'customer_champion',
                target: 50,
                xpReward: 250,
                badgeId: 'customer_champion'
            }
        };
    }

    _loadChallenges() {
        return StorageService.get('gamificationChallenges', []);
    }

    _initializeBadges() {
        return [
            { id: 'newcomer', name: '🌟 Начинаещ', description: 'Първа продажба' },
            { id: 'pro_seller', name: '💼 Професионалист', description: '10 продажби' },
            { id: 'master_seller', name: '👑 Майстор', description: '100 продажби' },
            { id: 'golden_cashier', name: '🥇 Златна Каса', description: '1000 лв приходи' },
            { id: 'diamond_cashier', name: '💎 Диамантена Каса', description: '10000 лв приходи' },
            { id: 'streak_master', name: '🔥 Майстор на Серията', description: '7 дни подред' },
            { id: 'perfect_day', name: '⭐ Перфектен Ден', description: '20+ продажби за ден' },
            { id: 'speed_demon', name: '⚡ Бърза Каса', description: '10 бързи продажби' },
            { id: 'customer_champion', name: '🏆 Шампион', description: '50 различни клиенти' },
            { id: 'level_5', name: '🎖️ Ниво 5', description: 'Достигна ниво 5' },
            { id: 'level_10', name: '🎖️ Ниво 10', description: 'Достигна ниво 10' },
            { id: 'level_20', name: '🎖️ Ниво 20', description: 'Достигна ниво 20' }
        ];
    }

    _calculateSalesStreak(sales) {
        if (sales.length === 0) return 0;

        // Sort sales by date
        const sortedSales = sales.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Group by day
        const daysSold = new Set();
        sortedSales.forEach(sale => {
            const day = new Date(sale.date).toISOString().split('T')[0];
            daysSold.add(day);
        });

        // Calculate current streak
        const today = new Date();
        let streak = 0;
        let checkDate = new Date(today);

        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            if (daysSold.has(dateStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    _checkPerfectDay(userId) {
        const today = new Date().toISOString().split('T')[0];
        const todaySales = this.salesService.getAllSales().filter(s => {
            const saleDate = new Date(s.date).toISOString().split('T')[0];
            return s.userId === userId && saleDate === today;
        });

        return todaySales.length >= 20;
    }

    _checkSpeedDemon(sales) {
        // Check if user has 10+ sales completed in under 1 minute
        let fastSales = 0;

        for (let i = 1; i < sales.length; i++) {
            const prevTime = new Date(sales[i - 1].date);
            const currTime = new Date(sales[i].date);
            const diffMinutes = (currTime - prevTime) / (1000 * 60);

            if (diffMinutes < 1) {
                fastSales++;
            }
        }

        return fastSales >= 10;
    }

    _getUserSalesInPeriod(userId, period) {
        const allSales = this.salesService.getAllSales().filter(s => s.userId === userId);
        const now = new Date();

        if (period === 'alltime') {
            return allSales;
        }

        let startDate;
        if (period === 'today') {
            startDate = new Date(now.toISOString().split('T')[0]);
        } else if (period === 'week') {
            startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        } else if (period === 'month') {
            startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        }

        return allSales.filter(s => new Date(s.date) >= startDate);
    }

    _updateDailyChallengeProgress(userId) {
        if (!this.userProgress[userId] || !this.userProgress[userId].dailyChallenge) {
            return;
        }

        const challenge = this.userProgress[userId].dailyChallenge;
        const today = new Date().toISOString().split('T')[0];

        // Skip if already completed or wrong date
        if (challenge.completed || challenge.date !== today) {
            return;
        }

        const todaySales = this._getUserSalesInPeriod(userId, 'today');

        switch (challenge.type) {
            case 'sales_target':
                challenge.progress = todaySales.length;
                break;

            case 'revenue_target':
                challenge.progress = todaySales.reduce((sum, s) => sum + s.total, 0);
                break;

            case 'speed_challenge':
                // Count sales under 2 minutes apart
                let fastSales = 0;
                for (let i = 1; i < todaySales.length; i++) {
                    const prevTime = new Date(todaySales[i - 1].date);
                    const currTime = new Date(todaySales[i].date);
                    const diffMinutes = (currTime - prevTime) / (1000 * 60);
                    if (diffMinutes < 2) fastSales++;
                }
                challenge.progress = fastSales;
                break;

            case 'perfect_accuracy':
                challenge.progress = todaySales.length;
                break;
        }

        // Check if completed
        if (challenge.progress >= challenge.target) {
            challenge.completed = true;
            this.awardExperience(userId, challenge.xpReward, `Дневно предизвикателство: ${challenge.name}`);
        }

        this._saveProgress();
    }

    _saveProgress() {
        StorageService.set('gamificationProgress', this.userProgress);
    }
}
