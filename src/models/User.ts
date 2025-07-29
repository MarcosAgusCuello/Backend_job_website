import mongoose from 'mongoose';
import bcryptjs from 'bcryptjs';

export interface IUser extends mongoose.Document {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    location?: string;
    bio?: string;
    skills?: string[];
    experience?: {
        title: string;
        company: string;
        from: Date;
        to?: Date;
        current?: boolean;
        description?: string;
    }[];
    education?: {
        school: string;
        degree: string;
        fieldOfStudy: string;
        from: Date;
        to?: Date;
        current?: boolean;
    }[];
    resume?: string; // URL to resume file
    profileImage?: string; // URL to profile image
    createdAt: Date;
    comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new mongoose.Schema<IUser>({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    location: String,
    bio: String,
    skills: [String],
    experience: [
        {
            title: {
                type: String,
                required: true
            },
            company: {
                type: String,
                required: true
            },
            from: {
                type: Date,
                required: true
            },
            to: Date,
            current: {
                type: Boolean,
                default: false
            },
            description: String
        }
    ],
    education: [
        {
            school: {
                type: String,
                required: true
            },
            degree: {
                type: String,
                required: true
            },
            fieldOfStudy: {
                type: String,
                required: true
            },
            from: {
                type: Date,
                required: true
            },
            to: Date,
            current: {
                type: Boolean,
                default: false
            }
        }
    ],
    resume: String,
    profileImage: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcryptjs.genSalt(10);
        this.password = await bcryptjs.hash(this.password, salt);
        next();
    } catch (error: any) {
        next(error);
    }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
    return bcryptjs.compare(candidatePassword, this.password);
}

export default mongoose.model<IUser>('User', UserSchema);