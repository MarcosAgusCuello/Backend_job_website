import express from 'express';
import * as userController from '../controllers/userController';
import { authUser } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', userController.register);
router.post('/login', userController.login);

// Protected routes (require authentication)
router.get('/me', authUser, userController.getCurrentUser);
router.put('/profile', authUser, userController.updateUser);
router.delete('/', authUser, userController.deleteUser);
router.post('/experience', authUser, userController.addExperience);
router.post('/education', authUser, userController.addEducation);

export default router;