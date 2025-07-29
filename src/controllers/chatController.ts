import { Request, Response } from 'express';
import Chat from '../models/Chat';
import Application from '../models/Application';
import Job from '../models/Job';
import User from '../models/User';
import mongoose from 'mongoose';

// Create a new chat when user applies for a job
export const createChat = async (
      applicationId: string,
      userId: string,
      companyId: string,
      jobId: string,
      jobTitle: string
): Promise<void> => {
      try {
            // Create a new chat
            const chat = new Chat({
                  applicationId,
                  userId,
                  companyId,
                  jobId,
                  messages: [{
                        sender: companyId,
                        content: `Thank you for applying for the position of ${jobTitle}. Our team will be in touch and you will be notified via this chat.`,
                        timestamp: new Date(),
                        isRead: false
                  }]
            });

            await chat.save();
      } catch (error) {
            console.error("Error creating chat:", error);
            throw error;
      }
};

// Get chats for a specific user
export const getUserChats = async (req: Request, res: Response): Promise<void> => {
      try {
            const userId = req.params.userId;

            const chats = await Chat.find({ userId })
                  .populate('jobId', 'title company')
                  .populate('companyId', 'name')
                  .sort({ updatedAt: -1 });

            res.status(200).json(chats);
      } catch (error) {
            console.error('Error getting user chats:', error);
            res.status(500).json({ message: 'Server error' });
      }
};

// Get chats for a specicif company
export const getCompanyChats = async (req: Request, res: Response): Promise<void> => {
      try {
            const companyId = req.params.companyId;

            const chats = await Chat.find({ companyId })
                  .populate('userId', 'name email')
                  .populate('jobId', 'title')
                  .sort({ updatedAt: -1 });

            res.status(200).json(chats);
      } catch (error) {
            console.error('Error getting company chats:', error);
            res.status(500).json({ message: 'Server error' });
      }
};

// Get a specific chat by ID
export const getChatById = async (req: Request, res: Response): Promise<void> => {
      try {
            const chatId = req.params.chatId;

            const chat = await Chat.findById(chatId)
                  .populate('userId', 'name email')
                  .populate('companyId', 'name')
                  .populate('jobId', 'title company');

            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            res.status(200).json(chat);
      } catch (error) {
            console.error('Error getting chat:', error);
            res.status(500).json({ message: 'Server error' });
      }
};

// Send a message in a chat
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
      try {
            const { chatId } = req.params;
            const { content, senderId } = req.body;

            if (!content || !senderId) {
                  res.status(400).json({ message: 'Message content and sender ID are required' });
                  return;
            }

            const chat = await Chat.findById(chatId);
            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            // Verify the sender is either the company or the applicant
            if (!chat.userId.equals(senderId) && !chat.companyId.equals(senderId)) {
                  res.status(403).json({ message: 'Unauthorized to send message in this chat' });
                  return;
            }

            // Add the message to the chat
            chat.messages.push({
                  sender: new mongoose.Types.ObjectId(senderId),
                  content,
                  timestamp: new Date(),
                  isRead: false
            });

            await chat.save();

            res.status(201).json(chat);
      } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ message: 'Server error' });
      }
};

// Mark messages as read
export const markMessagesAsRead = async (req: Request, res: Response): Promise<void> => {
      try {
            const { chatId } = req.params;
            const { userId } = req.body;

            const chat = await Chat.findById(chatId);
            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            // Mark all messages from the other user as read
            chat.messages.forEach(message => {
                  if (!message.sender.equals(userId) && !message.isRead) {
                        message.isRead = true;
                  }
            });

            await chat.save();

            res.status(200).json({ message: 'Messages marked as read' });
      } catch (error) {
            console.error('Error marking messages as read:', error);
            res.status(500).json({ message: 'Server error' });
      }
};

