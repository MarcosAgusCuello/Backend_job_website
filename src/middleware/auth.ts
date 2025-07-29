import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    company?: any;
    user?: any;
}

export const authCompany = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as any;

        // Check if the token is for a company
        if (!decoded.isCompany) {
            return res.status(403).json({ message: 'Access denied. Not a company account.' });
        }

        req.company = {
            id: decoded.id,
            ...decoded
        };

        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid authentication token' });
    }
};

export const authUser = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as any;

        // Check if the token is for a user
        if (decoded.isCompany) {
            return res.status(403).json({ message: 'Access denied. Not a user account.' });
        }

        // Add complete user info to request
        req.user = {
            ...decoded,            // Include all decoded properties
            id: decoded.id,        // Ensure id exists
            isCompany: false       // Explicitly set isCompany to false
        };

        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid authentication token' });
    }
}

// General auth that works for both users and companies
export const auth = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Authentication required'});
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'defaultsecret') as any;
        
        if (decoded.isCompany) {
            req.company = decoded;
        } else {
            req.user = decoded;
        }
        
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid authentication token' });
    }
};