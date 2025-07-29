import express from 'express';
import * as authController from '../controllers/authController';
import { auth } from '../middleware/auth';

const router = express.Router();

// Public Routes
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected Routes (require authentication)
router.put('/company', auth, authController.updateCompany);
router.delete('/company', auth, authController.deleteCompany);


export default router;
