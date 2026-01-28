import type { ConversionJob, CreateJobInput, UpdateJobInput } from "@shared/schema";

export interface IStorage {
  createJob(id: string, input: CreateJobInput & { inputPath?: string }): Promise<ConversionJob>;
  getJob(id: string): Promise<ConversionJob | undefined>;
  updateJob(id: string, input: UpdateJobInput & { inputPath?: string }): Promise<ConversionJob | undefined>;
  deleteJob(id: string): Promise<boolean>;
  getAllJobs(): Promise<ConversionJob[]>;
  getJobsByStatus(status: ConversionJob["status"]): Promise<ConversionJob[]>;
}

interface StoredJob extends ConversionJob {
  inputPath?: string;
}

export class MemStorage implements IStorage {
  private jobs: Map<string, StoredJob>;

  constructor() {
    this.jobs = new Map();
  }

  async createJob(id: string, input: CreateJobInput & { inputPath?: string }): Promise<ConversionJob> {
    const job: StoredJob = {
      id,
      fileName: input.fileName,
      originalName: input.originalName,
      fileSize: input.fileSize,
      bitrate: input.bitrate,
      inputPath: input.inputPath,
      status: "pending",
      progress: 0,
      createdAt: Date.now(),
    };
    this.jobs.set(id, job);
    return job;
  }

  async getJob(id: string): Promise<StoredJob | undefined> {
    return this.jobs.get(id);
  }

  async updateJob(id: string, input: UpdateJobInput & { inputPath?: string }): Promise<StoredJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updated: StoredJob = { ...job, ...input };
    this.jobs.set(id, updated);
    return updated;
  }

  async deleteJob(id: string): Promise<boolean> {
    return this.jobs.delete(id);
  }

  async getAllJobs(): Promise<ConversionJob[]> {
    return Array.from(this.jobs.values());
  }

  async getJobsByStatus(status: ConversionJob["status"]): Promise<ConversionJob[]> {
    return Array.from(this.jobs.values()).filter(job => job.status === status);
  }
}

export const storage = new MemStorage();
