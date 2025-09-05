import express from 'express';
import * as applicationController from '../controllers/applicationController';
import { auth, authUser, authCompany } from '../middleware/auth';

const router = express.Router();

// User routes
router.get('/user/applications', authUser, applicationController.getUserApplications);
router.get('/job/:jobId', authCompany, applicationController.getJobApplications);
router.post('/apply', authUser, applicationController.applyForJob);
router.delete('/withdraw/:applicationId', authUser, applicationController.withdrawApplication);
router.get('/:id', auth, applicationController.getApplicationById);

// Company routes

router.put('/:applicationId/status', authCompany, applicationController.updateApplicationStatus);
router.get('/:applicationId/cv', authCompany, applicationController.downloadApplicantCV);
router.get('/stats/company', authCompany, applicationController.getCompanyApplicationsStats);
router.get('/stats/job/:jobId', authCompany, applicationController.getJobApplicationsStats);

export default router;