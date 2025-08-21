import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

// Register a new user
export const register = async (req: Request, res: Response) => {
    try {
        console.log("User registration request body:", req.body);

        const { firstName, lastName, email, password, location, bio, skills } = req.body;

        // validate required fields
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['firstName', 'lastName', 'email', 'password'],
                received: Object.keys(req.body)
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists with this email' });
        }

        // Create new user
        const user = new User({
            firstName,
            lastName,
            email,
            password, // Note: Password should be hashed before saving in production
            location,
            bio,
            skills: skills || []
        });

        await user.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, isCompany: false },
            process.env.JWT_SECRET || 'defaultsecret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                location: user.location,
                skills: user.skills
            }
        });
    } catch (error) {
        console.error('User registration error:', error);
        res.status(500).json({
            message: 'Server error during user registration',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Login a user
export const login = async (req: Request, res: Response) => {
    try {
        console.log("User login request body:", req.body);

        const { email, password } = req.body;

        // validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required',
                received: Object.keys(req.body)
            });
        }

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid login credentials' });
        }

        // Cheack password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid login credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, isCompany: false },
            process.env.JWT_SECRET || 'defaultsecret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                location: user.location,
                skills: user.skills
            }
        });
    } catch (error) {
        console.error('User login error:', error);
        res.status(500).json({
            message: 'Server error during user login',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Update user profile
export const updateUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;
        const {
            firstName,
            lastName,
            email,
            location,
            bio,
            skills,
            resume,
            profileImage
        } = req.body;

        // Don't allow password update through this endpoint
        const updateData: any = {};

        if (firstName) updateData.firstName = firstName;
        if (lastName) updateData.lastName = lastName;
        if (email) updateData.email = email;
        if (location !== undefined) updateData.location = location;
        if (bio !== undefined) updateData.bio = bio;
        if (skills) updateData.skills = skills;
        if (resume !== undefined) updateData.resume = resume;
        if (profileImage !== undefined) updateData.profileImage = profileImage;

        // Check if email is being updated and if it's already in use
        if (email) {
            const existingUser = await User.findOne({ email, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(400).json({ message: 'Email is already in use' });
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'User updated successfully',
            user: {
                id: updatedUser._id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email,
                location: updatedUser.location,
                bio: updatedUser.bio,
                skills: updatedUser.skills,
                resume: updatedUser.resume,
                profileImage: updatedUser.profileImage
            }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            message: 'Server error during user update',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Delete user account
export const deleteUser = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const userId = req.user.id;

        const deletedUser = await User.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({
            message: 'User deleted sucessfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            message: 'Server error during user deletion',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Add Experience
export const addExperience = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { title, company, from, to, current, description } = req.body;

        // Validate required fields
        if (!title || !company || !from) {
            return res.status(400).json({
                message: 'Missing required field for experience',
                required: ['title', 'company', 'from'],
                received: Object.keys(req.body)
            });
        }

        const newExperience = {
            title,
            company,
            from: new Date(from),
            to: to ? new Date(to) : undefined,
            current: current || false,
            description
        };

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.experience = [...(user.experience || []), newExperience];
        await user.save();

        res.json({
            message: 'Experience added successfully',
            experience: newExperience
        });
    } catch (error) {
        console.error('Add experience error:', error);
        res.status(500).json({
            message: 'Server error during adding experience',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Add education
export const addEducation = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { school, degree, fieldOfStudy, from, to, current } = req.body;

        // Validate required fields
        if (!school || !degree || !fieldOfStudy || !from) {
            return res.status(400).json({
                message: 'Missing required fields for education',
                required: ['school', 'degree', 'fieldOfStudy', 'from'],
                received: Object.keys(req.body)
            });
        }

        const newEducation = {
            school,
            degree,
            fieldOfStudy,
            from: new Date(from),
            to: to ? new Date(to) : undefined,
            current: current || false
        };

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.education = [...(user.education || []), newEducation];
        await user.save();

        res.json({
            message: 'Education added successfully',
            education: user.education
        });
    } catch (error) {
        console.error('Add education error:', error);
        res.status(500).json({
            message: 'Server error while adding education',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Add skills to users profiles
export const addSkills = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { skills } = req.body;

        // Validate input
        if (!skills || !Array.isArray(skills) || skills.length === 0) {
            return res.status(400).json({ message: 'Please provide a skill' });
        }

        // Clean and Validate each skill
        const cleanedSkills = skills
            .map(skill => skill.trim())
            .filter(skill => skill.length > 0 && skill.length <= 30); // Max length 30 chars

        if (cleanedSkills.length === 0) {
            return res.status(400).json({ message: 'No valid skills provided' });
        }

        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Initialize skills
        if (!user.skills) {
            user.skills = [];
        }

        // Add new skills avoiding duplicates
        const uniqueSkills = new Set(...user.skills, ...cleanedSkills);
        user.skills = Array.from(uniqueSkills);

        await user.save();

        // Return updated skills
        const updatedUser = await User.findById(req.user.id)
            .select('-password')
            .populate('experience')
            .populate('education');

        res.json({ updatedUser });
    } catch (error) {
        console.error('Add skills error:', error);
        res.status(500).json({
            message: 'Server error while adding skills',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Remove a skill from user profile
export const removeSkill = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const { skill } = req.params;

        if (!skill) {
            return res.status(400).json({ message: 'Skill parameter is required' });
        }

        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has no skills, nothing to remove
        if (!user.skills || user.skills.length === 0) {
            return res.status(400).json({ message: 'User has no skills to remove' });
        }

        // Remove the skill if it exists
        const decodedSkill = decodeURIComponent(skill);
        const initialLength = user.skills.length;
        user.skills = user.skills.filter(s => s !== decodedSkill);

        // Check if any skill was removed
        if (user.skills.length === initialLength) {
            return res.status(404).json({ message: 'Skill not found in user profile' });
        }

        await user.save();

        // Return updated user without password
        const updatedUser = await User.findById(req.user.id)
            .select('-password')
            .populate('experience')
            .populate('education');

        res.json(updatedUser);
    } catch (error) {
        console.error('Remove skill error:', error);
        res.status(500).json({
            message: 'Server error while removing skill',
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

// Get the current user's profile
export const getCurrentUser = async (req: AuthRequest, res: Response) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Find the user by ID and exclude password
        const user = await User.findById(req.user.id)
            .select('-password')
            .populate('experience')
            .populate('education');

        if (!user) {
            // Add debugging log
            console.error(`User not found with ID: ${req.user.id}`);
            return res.status(404).json({ message: 'User not found' });
        }

        // Return the user data
        res.json(user);
    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            message: 'Server error while fetching user profile',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Upload CV
export const uploadCV = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Validate file type
        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ message: 'Only PDF files are allowed' });
        }
        
        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user CV
        user.cv = {
            data: req.file.buffer,
            originalName: req.file.originalname,
            uploadDate: new Date(),
            size: req.file.size
        }

        await user.save();

        // Return CV info
        res.json({
            message: 'CV uploaded successfully',
            cv: {
                originalName: user.cv.originalName,
                uploadDate: user.cv.uploadDate,
                size: user.cv.size
            }
        });
    } catch (error) {
        console.error('Upload CV error:', error);
        res.status(500).json({
            message: 'Server error while uploading CV',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Delete CV
export const deleteCV = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has no CV
        if (!user.cv ) {
            return res.status(400).json({ message: 'User has no CV to delete' });
        }

        // Remove CV from user Document
        user.cv = undefined;
        await user.save();

        res.json({
            message: 'CV deleted successfully'
        });
    } catch (error) {
        console.error('Delete CV error:', error);
        return res.status(500).json({
            message: 'Server error while deleting CV',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Get CV information (metadata only)
export const getCVInfo = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has no cv
        if (!user.cv) {
            return res.status(404).json({ message: 'User has no CV' });
        }

        // Return CV info
        res.json({
            cv: {
                originalName: user.cv.originalName,
                uploadDate: user.cv.uploadDate,
                size: user.cv.size
            }
        });
    } catch (error) {
        console.error('Get CV info error:', error);
        res.status(500).json({ 
            message: 'Server error while fetching CV info',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Download CV (PDF file)
export const downloadCV = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Find the user
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // If user has no CV
        if (!user.cv || !user.cv.data) {
            return res.status(404).json({ message: 'User has no CV to download' });
        }

        // Set appropiate headers for PDF download
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${user.cv.originalName}"`,
            'Content-Length': user.cv.size
        });

        // Send the PDF Data
        res.send(user.cv.data);
    } catch (error) {
        console.error('Download CV error:', error);
        res.status(500).json({
            message: 'Server error while downloading CV',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

