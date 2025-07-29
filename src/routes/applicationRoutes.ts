import express from 'express';
import * as applicationController from '../controllers/applicationController';
import { auth, authUser, authCompany } from '../middleware/auth';

const router = express.Router();

// User routes
router.post('/apply', authUser, applicationController.applyForJob);
router.get('/user/applications', authUser, applicationController.getUserApplications);
router.delete('/withdraw/:applicationId', authUser, applicationController.withdrawApplication);

// Company routes
router.get('/job/:jobId', authCompany, applicationController.getJobApplications);
router.put('/:applicationId/status', authCompany, applicationController.updateApplicationStatus);

export default router;