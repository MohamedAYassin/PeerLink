import fs from 'fs/promises';
import path from 'path';
import { Logger } from '../utils/logger.utils';

const DATA_DIR = path.join(__dirname, '../../data');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

interface StatsData {
    filesSent: number;
}

export class StatsService {
    private stats: StatsData = {
        filesSent: 0
    };
    private initialized = false;

    private async ensureDataDir() {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
        }
    }

    private async loadStats() {
        try {
            await this.ensureDataDir();
            const data = await fs.readFile(STATS_FILE, 'utf-8');
            this.stats = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or is invalid, start with defaults
            await this.saveStats();
        }
        this.initialized = true;
    }

    private async saveStats() {
        try {
            await this.ensureDataDir();
            await fs.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2));
        } catch (error) {
            Logger.error(error, 'Failed to save stats');
        }
    }

    async incrementFilesSent() {
        if (!this.initialized) await this.loadStats();
        this.stats.filesSent++;
        await this.saveStats();
    }

    async getStats(): Promise<StatsData> {
        if (!this.initialized) await this.loadStats();
        return { ...this.stats };
    }
}

export const statsService = new StatsService();
