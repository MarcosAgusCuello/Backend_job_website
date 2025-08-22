import { Response } from 'express';
import Chat from '../models/Chat';
import Job from '../models/Job';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';

// Create a new chat when user applies for a job
export const createChat = async (
      applicationId: string,
      userId: string,
      companyId: string,
      jobId: string,
      jobTitle: string
): Promise<void> => {
      try {
            // Check if a chat already exists for this application
            const existingChat = await Chat.findOne({ applicationId });
            if (existingChat) {
                  return;
            }

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

// Get all chats for the authenticated user or company
export const getChats = async (req: AuthRequest, res: Response): Promise<void> => {
      try {
            if (!req.user && !req.company) {
                  res.status(401).json({ message: 'Authentication required' });
                  return;
            }

            let chats;
            let query = {};
            let populateOptions: string | string[] | { path: string; select: string; }[] = [];

            if (req.user) {
                  // User is requesting their chats
                  query = { userId: req.user.id };
                  populateOptions = [
                        { path: 'jobId', select: 'title location type' },
                        {
                              path: 'companyId',
                              select: 'companyName logo'
                        }
                  ];
            } else if (req.company) {
                  // Company is requesting their chats
                  query = { companyId: req.company.id };
                  populateOptions = [
                        { path: 'jobId', select: 'title' },
                        {
                              path: 'userId',
                              select: 'firstName lastName email profileImage'
                        }
                  ];
            }

            chats = await Chat.find(query)
                  .populate(populateOptions)
                  .sort({ updatedAt: -1 });

            // Format the response to include unread message count
            const formattedChats = chats.map(chat => {
                  const chatObj = chat.toObject();
                  let unreadCount = 0;

                  if (req.user) {
                        // Count messages from company that are unread
                        unreadCount = chatObj.messages.filter(
                              msg => msg.sender.toString() === chatObj.companyId._id.toString() && !msg.isRead
                        ).length;
                  } else if (req.company) {
                        // Count messages from user that are unread
                        unreadCount = chatObj.messages.filter(
                              msg => msg.sender.toString() === chatObj.userId._id.toString() && !msg.isRead
                        ).length;
                  }

                  // Get the last message for preview
                  const lastMessage = chatObj.messages.length > 0
                        ? chatObj.messages[chatObj.messages.length - 1]
                        : null;

                  return {
                        _id: chatObj._id,
                        applicationId: chatObj.applicationId,
                        userId: chatObj.userId,
                        companyId: chatObj.companyId,
                        jobId: chatObj.jobId,
                        unreadCount,
                        lastMessage: lastMessage ? {
                              content: lastMessage.content,
                              timestamp: lastMessage.timestamp,
                              isFromCompany: lastMessage.sender.toString() === chatObj.companyId._id.toString()
                        } : null,
                        createdAt: chatObj.createdAt,
                        updatedAt: chatObj.updatedAt
                  };
            });

            res.status(200).json(formattedChats);
      } catch (error) {
            console.error('Error getting chats:', error);
            res.status(500).json({
                  message: 'Server error while fetching chats',
                  error: error instanceof Error ? error.message : String(error)
            });
      }
};

// Get a specific chat by ID with messages
export const getChatById = async (req: AuthRequest, res: Response): Promise<void> => {
      try {
            if (!req.user && !req.company) {
                  res.status(401).json({ message: 'Authentication required' });
                  return;
            }

            const { chatId } = req.params;

            const chat = await Chat.findById(chatId)
                  .populate('userId', 'firstName lastName email profileImage')
                  .populate('companyId', 'companyName logo')
                  .populate('jobId', 'title location type');

            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            // Verify the requester is part of this chat
            if (
                  (req.user && chat.userId._id.toString() !== req.user.id) ||
                  (req.company && chat.companyId._id.toString() !== req.company.id)
            ) {
                  res.status(403).json({
                        message: 'You do not have permission to access this chat'
                  });
                  return;
            }

            res.status(200).json(chat);
      } catch (error) {
            console.error('Error getting chat by ID:', error);
            res.status(500).json({
                  message: 'Server error while fetching chat',
                  error: error instanceof Error ? error.message : String(error)
            });
      }
};

// Send a message in a chat
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
      try {
            if (!req.user && !req.company) {
                  res.status(401).json({ message: 'Authentication required' });
                  return;
            }

            const { chatId } = req.params;
            const { content } = req.body;

            if (!content) {
                  res.status(400).json({ message: 'Message content is required' });
                  return;
            }

            const chat = await Chat.findById(chatId);
            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            // Determine sender ID based on who is authenticated
            const senderId = req.user ? req.user.id : req.company.id;

            // Verify the sender is either the user or the company in this chat
            if (
                  (req.user && chat.userId.toString() !== req.user.id) ||
                  (req.company && chat.companyId.toString() !== req.company.id)
            ) {
                  res.status(403).json({ message: 'You do not have permission to send messages in this chat' });
                  return;
            }

            // Add the message to the chat
            chat.messages.push({
                  sender: new mongoose.Types.ObjectId(senderId),
                  content,
                  timestamp: new Date(),
                  isRead: false
            });

            // Update the updatedAt timestamp
            chat.updatedAt = new Date();

            await chat.save();

            res.status(201).json(chat);
      } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({
                  message: 'Server error while sending message',
                  error: error instanceof Error ? error.message : String(error)
            });
      }
};

// Mark messages as read
export const markChatAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
      try {
            if (!req.user && !req.company) {
                  res.status(401).json({ message: 'Authentication required' });
                  return;
            }

            const { chatId } = req.params;

            const chat = await Chat.findById(chatId);
            if (!chat) {
                  res.status(404).json({ message: 'Chat not found' });
                  return;
            }

            // Verify the requester is part of this chat
            if (
                  (req.user && chat.userId.toString() !== req.user.id) ||
                  (req.company && chat.companyId.toString() !== req.company.id)
            ) {
                  res.status(403).json({ message: 'You do not have permission to access this chat' });
                  return;
            }

            // Determine which messages to mark as read based on who is making the request
            const currentUserId = req.user ? req.user.id : req.company.id;

            // Mark messages as read where the sender is NOT the current user
            let updated = false;
            chat.messages.forEach(message => {
                  if (message.sender.toString() !== currentUserId && !message.isRead) {
                        message.isRead = true;
                        updated = true;
                  }
            });

            if (updated) {
                  await chat.save();
            }

            res.status(200).json({ message: 'Messages marked as read' });
      } catch (error) {
            console.error('Error marking messages as read:', error);
            res.status(500).json({
                  message: 'Server error while marking messages as read',
                  error: error instanceof Error ? error.message : String(error)
            });
      }
};

// Utility to create a chat when a user applies for a job
export const createChatForApplication = async (application: any): Promise<void> => {
      try {
            const job = await Job.findById(application.job).populate('company', 'companyName') as {
                  _id: mongoose.Types.ObjectId;
                  company: { _id: mongoose.Types.ObjectId; companyName: string };
                  title: string;
            } | null;

            if (!job) {
                  console.error('Job not found for application:', application._id);
                  return;
            }

            await createChat(
                  application._id.toString(),
                  application.user.toString(),
                  job.company._id.toString(),
                  job._id.toString(),
                  job.title
            );
      } catch (error) {
            console.error('Error creating chat for application:', error);
      }
};