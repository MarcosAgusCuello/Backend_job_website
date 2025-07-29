import express from 'express';
import * as jobController from '../controllers/jobController';
import { auth, authCompany } from '../middleware/auth';

const router = express.Router();

// Public routes
router.get('/', jobController.getJobs);
router.get('/search', jobController.searchJobs);
router.get('/:id', jobController.getJobById);

// Company-only routes (require company authentication)
router.post('/', authCompany, jobController.createJob);
router.get('/company/myjobs', authCompany, jobController.getCompanyJobs);
router.put('/:id', authCompany, jobController.updateJob);
router.delete('/:id', authCompany, jobController.deleteJob);

export default router;