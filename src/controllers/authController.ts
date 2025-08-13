import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Company from '../models/Company';
import { AuthRequest } from '../middleware/auth';

// Register a new company
export const register = async (req: Request, res: Response) => {
    try {
        console.log("Registration request body:", req.body);

        const { companyName, email, password, industry, location, description, website, logo } = req.body;

        // Validate required fields
        if (!companyName || !email || !password || !industry || !location) {
            return res.status(400).json({
                message: 'Missing required fields',
                required: ['companyName', 'email', 'password', 'industry', 'location'],
                received: Object.keys(req.body)
            });
        }

        // Check if company already exists
        const existingCompany = await Company.findOne({ email });
        if (existingCompany) {
            return res.status(400).json({ message: 'Company already exists' });
        }

        // Create new company
        const company = new Company({
            companyName,
            email,
            password,
            industry,
            location,
            description,
            website,
            logo
        });

        await company.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: company._id, isCompany: true },
            process.env.JWT_SECRET || 'defaultsecret',
            { expiresIn: '24h' }
        );

        res.status(201).json({
            message: 'Company registered successfully',
            token,
            company: {
                id: company._id,
                companyName: company.companyName,
                email: company.email,
                industry: company.industry,
                location: company.location
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            message: 'Server error during registration',
            error: error instanceof Error ? error.message : String(error)
        });
    }
};

// Login a company
export const login = async (req: Request, res: Response) => {
    try {
        console.log("Login request body:", req.body);

        const { email, password } = req.body;

        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required',
                received: Object.keys(req.body)
            });
        }

        // Find company by email
        const company = await Company.findOne({ email });
        if (!company) {
            return res.status(401).json({ message: 'Invalid login credentials' });
        }

        // Check password
        const isMatch = await company.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid login credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: company._id, isCompany: true },
            process.env.JWT_SECRET || 'defaultsecret',
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            company: {
                id: company._id,
                companyName: company.companyName,
                email: company.email,
                industry: company.industry,
                location: company.location
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Server error during login',
            error: error instanceof Error ? error.message : String(error)
        });
    }
}

// Update company profile
export const updateCompany = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.company) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const companyId = req.company.id;
        const {
            companyName,
            email,
            industry,
            location,
            description,
            website,
            logo
        } = req.body;

        // Don't allow password update through this endpoint
        const updateData: any = {};

        if (companyName) updateData.companyName = companyName;
        if (email) updateData.email = email;
        if (industry) updateData.industry = industry;
        if (location) updateData.location = location;
        if (description !== undefined) updateData.description = description;
        if (website !== undefined) updateData.website = website;
        if (logo !== undefined) updateData.logo = logo;

        // Check if email is being updated and if it's already in use
        if (email) {
            const existingCompany = await Company.findOne({ email, _id: { $ne: companyId } });
            if (existingCompany) {
                return res.status(400).json({ message: 'Email is already in use' });
            }
        }

        const updatedCompany = await Company.findByIdAndUpdate(
            companyId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        if (!updatedCompany) {
            return res.status(404).json({ message: 'Company not found' });
        }

        res.json({
            message: 'Company updated successfully',
            company: {
                id: updatedCompany._id,
                companyName: updatedCompany.companyName,
                email: updatedCompany.email,
                industry: updatedCompany.industry,
                location: updatedCompany.location,
                description: updatedCompany.description,
                website: updatedCompany.website,
                logo: updatedCompany.logo
            }
        });
    } catch (error) {
        console.error('Update company error:', error);
        res.status(500).json({
            message: 'Server error during company update',
            error: error instanceof Error ? error.message : String(error)
        })
    }
}

// Delete company profile
export const deleteCompany = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.company) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const companyId = req.company.id;

        const deletedCompany = await Company.findByIdAndDelete(companyId);

        if (!deletedCompany) {
            return res.status(404).json({ message: 'Company not found' });
        }

        res.json({
            message: 'Company deleted successfully'
        });
    } catch (error) {
        console.error('Delete company error:', error);
        res.status(500).json({
            message: 'Server error during company deletion',
            error: error instanceof Error ? error.message : String(error)
        })
    }
}