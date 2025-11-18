/**
 * AuthService - Authentication and user management
 */
import { StorageService } from './StorageService.js';
import { ValidationService } from './ValidationService.js';

export class AuthService {
    constructor() {
        this.currentUser = null;
        this.users = [];
        this.loadUsers();
    }

    /**
     * Load users from storage
     */
    loadUsers() {
        this.users = StorageService.getUsers();

        // Ensure default admin exists
        if (this.users.length === 0) {
            this.users = [{
                id: 1,
                username: 'admin',
                password: 'admin',
                name: 'Администратор',
                role: 'admin'
            }];
            StorageService.setUsers(this.users);
        }
    }

    /**
     * Save users to storage
     */
    saveUsers() {
        StorageService.setUsers(this.users);
    }

    /**
     * Check if user is logged in
     */
    checkLogin() {
        const storedUser = StorageService.getCurrentUser();
        if (storedUser) {
            this.currentUser = storedUser;
            return true;
        }
        return false;
    }

    /**
     * Attempt login
     */
    login(username, password) {
        // Validate credentials
        const validation = ValidationService.validateCredentials(username, password);
        if (!validation.isValid) {
            return {
                success: false,
                error: validation.errors.join(', ')
            };
        }

        // Sanitize username
        const cleanUsername = ValidationService.sanitizeString(username);

        // Find user
        const user = this.users.find(u =>
            u.username === cleanUsername && u.password === password
        );

        if (!user) {
            return {
                success: false,
                error: 'Грешно потребителско име или парола!'
            };
        }

        // Login successful
        this.currentUser = user;
        StorageService.setCurrentUser(user);

        return {
            success: true,
            user: user
        };
    }

    /**
     * Logout
     */
    logout() {
        this.currentUser = null;
        StorageService.clearCurrentUser();
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if current user is admin
     */
    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    /**
     * Add new user (admin only)
     */
    addUser(userData) {
        if (!this.isAdmin()) {
            return {
                success: false,
                error: 'Нямате права да добавяте потребители'
            };
        }

        // Validate credentials
        const validation = ValidationService.validateCredentials(
            userData.username,
            userData.password
        );

        if (!validation.isValid) {
            return {
                success: false,
                error: validation.errors.join(', ')
            };
        }

        // Check if username exists
        const cleanUsername = ValidationService.sanitizeString(userData.username);
        if (this.users.some(u => u.username === cleanUsername)) {
            return {
                success: false,
                error: 'Потребителското име вече съществува'
            };
        }

        // Create new user
        const newUser = {
            id: Date.now(),
            username: cleanUsername,
            password: userData.password,
            name: ValidationService.sanitizeString(userData.name || cleanUsername),
            role: userData.role || 'cashier'
        };

        this.users.push(newUser);
        this.saveUsers();

        return {
            success: true,
            user: newUser
        };
    }

    /**
     * Update user (admin only)
     */
    updateUser(userId, updates) {
        if (!this.isAdmin()) {
            return {
                success: false,
                error: 'Нямате права да променяте потребители'
            };
        }

        const user = this.users.find(u => u.id === userId);
        if (!user) {
            return {
                success: false,
                error: 'Потребителят не е намерен'
            };
        }

        // Update fields
        if (updates.name) {
            user.name = ValidationService.sanitizeString(updates.name);
        }

        if (updates.password) {
            const validation = ValidationService.validateCredentials('user', updates.password);
            if (!validation.isValid) {
                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }
            user.password = updates.password;
        }

        if (updates.role && ['admin', 'cashier'].includes(updates.role)) {
            user.role = updates.role;
        }

        this.saveUsers();

        return {
            success: true,
            user: user
        };
    }

    /**
     * Delete user (admin only)
     */
    deleteUser(userId) {
        if (!this.isAdmin()) {
            return {
                success: false,
                error: 'Нямате права да изтривате потребители'
            };
        }

        // Prevent deleting yourself
        if (this.currentUser && this.currentUser.id === userId) {
            return {
                success: false,
                error: 'Не можете да изтриете собствения си акаунт'
            };
        }

        // Prevent deleting last admin
        const user = this.users.find(u => u.id === userId);
        if (user && user.role === 'admin') {
            const adminCount = this.users.filter(u => u.role === 'admin').length;
            if (adminCount <= 1) {
                return {
                    success: false,
                    error: 'Не можете да изтриете последния администратор'
                };
            }
        }

        this.users = this.users.filter(u => u.id !== userId);
        this.saveUsers();

        return {
            success: true
        };
    }

    /**
     * Get all users (admin only)
     */
    getAllUsers() {
        if (!this.isAdmin()) {
            return [];
        }
        return this.users;
    }
}
