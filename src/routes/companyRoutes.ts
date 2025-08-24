import express from 'express';
import * as companyController from '../controllers/companyController';
import { authCompany } from '../middleware/auth';

const router = express.Router();

// Protected routes (explicit paths first)
router.get('/profile', authCompany, companyController.getCompanyProfile);
router.put('/profile', authCompany, companyController.updateCompanyProfile);

// Public routes (parameterized routes last)
router.get('/', companyController.getAllCompanies); // Get all companies (with pagination)
router.get('/:id', companyController.getCompanyById); // Get company by ID
router.get('/:id/with-jobs', companyController.getCompanyWithJobs);

export default router;