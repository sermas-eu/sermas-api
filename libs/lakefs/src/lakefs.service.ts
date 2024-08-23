import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class LakeFSService {
  private readonly logger = new Logger(LakeFSService.name);
  lakefsUrl: string;
  authHeader: any;

  constructor(private readonly config: ConfigService) {
    this.lakefsUrl = this.config.get('LAKEFS_URL') + '/api/v1';
    const base64Auth = btoa(
      `${this.config.get('LAKEFS_ACCESSKEYID')}:${this.config.get(
        'LAKEFS_SECRETKEY',
      )}`,
    );
    this.authHeader = { Authorization: `Basic ${base64Auth}` };
  }

  async createBranch(repository: string, branch: string): Promise<void> {
    this.logger.log(`Creating branch ${branch} on repository=${repository}`);
    await axios.post(
      `${this.lakefsUrl}/repositories/${repository}/branches`,
      { name: branch, source: 'main' },
      { headers: this.authHeader },
    );
  }

  async listBranches(repository: string): Promise<any> {
    const branches = await axios.get(
      `${this.lakefsUrl}/repositories/${repository}/branches?amount=0`,
      {
        headers: this.authHeader,
      },
    );
    return branches.data.results;
  }

  async listObjects(repository: string, branch: string): Promise<any> {
    const objects = await axios.get(
      `${this.lakefsUrl}/repositories/${repository}/refs/${branch}/objects/ls`,
      {
        headers: this.authHeader,
      },
    );
    return objects.data.results;
  }

  async getObject(
    repository: string,
    branch: string,
    path: string,
  ): Promise<any> {
    const obj = await axios.get(
      `${this.lakefsUrl}/repositories/${repository}/refs/${branch}/objects?path=${path}`,
      {
        headers: this.authHeader,
      },
    );
    return obj.data;
  }

  async uploadFile(
    repository: string,
    branch: string,
    formdata: FormData,
    filename: string,
  ): Promise<void> {
    this.logger.log(
      `Uploading file to repository=${repository} branch=${branch}`,
    );
    await axios.post(
      `${this.lakefsUrl}/repositories/${repository}/branches/${branch}/objects?path=${filename}`,
      formdata,
      { headers: this.authHeader },
    );
  }

  async commit(repository: string, branch: string): Promise<void> {
    const data = {
      message: `Uploaded ${branch} data`,
      metadata: {},
      date: new Date(),
    };
    this.logger.log(
      `Commit for branch=${branch} on repository=${repository}, message=${data.message}`,
    );
    await axios.post(
      `${this.lakefsUrl}/repositories/${repository}/branches/${branch}/commits`,
      data,
      { headers: this.authHeader },
    );
  }

  async downloadFile(
    repository: string,
    branch: string,
    filename: string,
  ): Promise<string> {
    try {
      this.logger.log(`Getting objects list of branch ${branch}`);
      const res = await this.getObjectsList(repository, branch);
      const objList = res.data.results;
      if (objList.length === 0)
        throw new BadRequestException('LakeFS branch empty!');
      const object = await axios.get(
        `${this.lakefsUrl}/repositories/${repository}/refs/${branch}/objects?path=${filename}`,
        { headers: this.authHeader },
      );
      return object.data;
    } catch (e) {
      this.logger.error('Error fetching lakeFS');
    }
  }

  async getObjectsList(repository: string, branch: string): Promise<any> {
    return await axios.get(
      `${this.lakefsUrl}/repositories/${repository}/refs/${branch}/objects/ls`,
      { headers: this.authHeader },
    );
  }

  async deleteFile(
    repository: string,
    branch: string,
    filename: string,
  ): Promise<void> {
    return await axios.delete(
      `${this.lakefsUrl}/repositories/${repository}/branches/${branch}/objects?path=${filename}`,
      { headers: this.authHeader },
    );
  }
}
