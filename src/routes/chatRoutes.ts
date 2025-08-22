import express from 'express';
import * as chatController from '../controllers/chatController';
import * as applicationController from '../controllers/applicationController';
import { auth, authUser, authCompany } from '../middleware/auth';

const router = express.Router();

// Application-specific routes first
router.post('/application/:applicationId', auth, applicationController.createChatForApplication);

// Get all chats
router.get('/', auth, chatController.getChats);
router.get('/user', authUser, chatController.getChats);
router.get('/company', authCompany, chatController.getChats);

// Chat-specific operations
router.get('/:chatId', auth, chatController.getChatById);
router.get('/:chatId/company', authCompany, chatController.getChatById);
router.post('/:chatId/messages', auth, chatController.sendMessage);
router.put('/:chatId/read', auth, chatController.markChatAsRead);

export default router;