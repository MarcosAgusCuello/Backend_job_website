import express from 'express';
import * as userController from '../controllers/userController';
import { authUser } from '../middleware/auth';
import upload from '../config/multerConfig';

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

// Skills routes
router.post('/skills', authUser, userController.addSkills);
router.delete('/skills/:skill', authUser, userController.removeSkill);

// CV routes
router.post('/cv', authUser, upload.single('cv'), userController.uploadCV);
router.delete('/cv', authUser, userController.deleteCV);
router.get('/cv/info', authUser, userController.getCVInfo);
router.get('/cv/download', authUser, userController.downloadCV);

export default router;