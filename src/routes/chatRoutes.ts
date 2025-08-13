import express from 'express';
import {
  getUserChats,
  getCompanyChats,
  getChatById,
  sendMessage,
  markMessagesAsRead
} from '../controllers/chatController';
import { auth, authUser, authCompany } from '../middleware/auth';

const router = express.Router();

// Get all chats for a user - should only be accessible by that user
router.get('/user/:userId', authUser, getUserChats);

// Get all chats for a company - should only be accessible by that company
router.get('/company/:companyId', authCompany, getCompanyChats);

// Get a specific chat - both users and companies should be able to access their own chats
router.get('/:chatId', auth, getChatById);

// Send a message in a chat - both users and companies should be able to send messages
router.post('/:chatId/message', auth, sendMessage);

// Mark messages as read - both users and companies should be able to mark messages as read
router.patch('/:chatId/read', auth, markMessagesAsRead);

export default router;