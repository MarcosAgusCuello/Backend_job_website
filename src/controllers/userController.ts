import e, { Request, Response } from 'express';
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