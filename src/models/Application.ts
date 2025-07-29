import mongoose from 'mongoose';

export interface IApplication extends mongoose.Document {
    job: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    company: mongoose.Types.ObjectId;
    coverLetter?: string;
    resume?: string;
    status: 'pending' | 'reviewed' | 'interviewing' | 'rejected' | 'accepted';
    appliedAt: Date;
}

const ApplicationSchema = new mongoose.Schema<IApplication>({
    job: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Job',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true
    },
    coverLetter: {
        type: String
    },
    resume: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'interviewing', 'rejected', 'accepted'],
        default: 'pending'
    },
    appliedAt: {
        type: Date,
        default: Date.now
    }
})

// Prevent duplicate applications for the same job by the same user
ApplicationSchema.index({ job: 1, user: 1}, { unique: true });

export default mongoose.model<IApplication>('Application', ApplicationSchema);