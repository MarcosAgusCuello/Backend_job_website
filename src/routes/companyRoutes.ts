import express from 'express';
import * as companyController from '../controllers/companyController';
import { auth, authCompany } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/:id', companyController.getCompanyById); // Get company by ID
router.get('/', companyController.getAllCompanies); // Get all companies (with pagination)
router.get('/:id/with-jobs', companyController.getCompanyWithJobs);

// Protected routes (require company authentication)
router.put('/profile', authCompany, companyController.updateCompanyProfile);

export default router;