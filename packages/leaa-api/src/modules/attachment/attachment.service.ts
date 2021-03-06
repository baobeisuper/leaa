import fs from 'fs';
import _ from 'lodash';
import { Express } from 'express';
import { Repository, In, SelectQueryBuilder } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Attachment } from '@leaa/common/src/entrys';
import {
  AttachmentsWithPaginationObject,
  UpdateAttachmentInput,
  DeleteAttachmentsObject,
  UpdateAttachmentsInput,
  AttachmentsObject,
} from '@leaa/common/src/dtos/attachment';
import {
  IAttachmentDbFilterField,
  ISaveInOssSignature,
  ISaveInLocalSignature,
  IAttachmentParams,
} from '@leaa/common/src/interfaces';
import { argsUtil, loggerUtil, pathUtil, authUtil, attachmentUtil, paginationUtil, msgUtil } from '@leaa/api/src/utils';
import { ConfigService } from '@leaa/api/src/modules/config/config.service';
import { IAttachmentsArgs, IAttachmentArgs, IGqlCtx } from '@leaa/api/src/interfaces';
import { SaveInOssService } from '@leaa/api/src/modules/attachment/save-in-oss.service';
import { SaveInLocalService } from '@leaa/api/src/modules/attachment/save-in-local.service';

const CLS_NAME = 'AttachmentService';

@Injectable()
export class AttachmentService {
  constructor(
    @InjectRepository(Attachment) private readonly attachmentRepository: Repository<Attachment>,
    private readonly configService: ConfigService,
    private readonly saveInLocalServer: SaveInLocalService,
    private readonly saveInOssServer: SaveInOssService,
  ) {}

  getSignature(): Promise<ISaveInOssSignature | ISaveInLocalSignature> | null {
    if (this.configService.ATTACHMENT_SAVE_IN_OSS) {
      return this.saveInOssServer.getSignature();
    }

    if (this.configService.ATTACHMENT_SAVE_IN_LOCAL) {
      return this.saveInLocalServer.getSignature();
    }

    loggerUtil.warn('Signature Missing SAVE_IN... Params', CLS_NAME);

    return null;
  }

  async attachments(args: IAttachmentsArgs, gqlCtx?: IGqlCtx): Promise<AttachmentsWithPaginationObject> {
    const nextArgs = argsUtil.format(args, gqlCtx);

    const moduleFilter: IAttachmentDbFilterField = {};

    if (nextArgs.moduleName) {
      moduleFilter.module_name = nextArgs.moduleName;
    }

    if (nextArgs.moduleId) {
      moduleFilter.module_id = nextArgs.moduleId;
    }

    if (nextArgs.typeName) {
      moduleFilter.type_name = nextArgs.typeName;
    }

    if (nextArgs.typePlatform) {
      moduleFilter.type_platform = nextArgs.typePlatform;
    }

    const qb = this.attachmentRepository.createQueryBuilder();
    qb.select().orderBy(nextArgs.orderBy || 'created_at', nextArgs.orderSort);
    qb.where(moduleFilter);

    if (nextArgs.q) {
      const aliasName = new SelectQueryBuilder(qb).alias;

      ['title', 'slug'].forEach(q => {
        qb.orWhere(`${aliasName}.${q} LIKE :${q}`, { [q]: `%${nextArgs.q}%` });
      });
    }

    if (!gqlCtx?.user || (gqlCtx.user && !authUtil.can(gqlCtx.user, 'attachment.list-read--all-status'))) {
      qb.andWhere('status = :status', { status: 1 });
    }

    if (nextArgs.orderBy && nextArgs.orderSort) {
      qb.orderBy({ [nextArgs.orderBy]: nextArgs.orderSort });
    } else {
      qb.orderBy({ sort: 'ASC' }).addOrderBy('created_at', 'ASC');
    }

    return paginationUtil.calcQbPageInfo({ qb, page: nextArgs.page, pageSize: nextArgs.pageSize });
  }

  async attachment(uuid: string, args?: IAttachmentArgs, gqlCtx?: IGqlCtx): Promise<Attachment | undefined> {
    let nextArgs: IAttachmentArgs = {};

    if (args) nextArgs = args;

    const whereQuery: { uuid: string; status?: number } = { uuid };

    if (!gqlCtx?.user || (gqlCtx.user && !authUtil.can(gqlCtx.user, 'attachment.item-read--all-status'))) {
      whereQuery.status = 1;
    }

    return this.attachmentRepository.findOne({
      ...nextArgs,
      where: whereQuery,
    });
  }

  async createAttachmentByLocal(
    body: IAttachmentParams,
    file: Express.Multer.File,
  ): Promise<{ attachment: Attachment } | undefined> {
    return this.saveInLocalServer.createAttachmentByLocal(body, file);
  }

  async updateAttachment(uuid: string, args: UpdateAttachmentInput, gqlCtx?: IGqlCtx): Promise<Attachment | undefined> {
    if (!args) throw msgUtil.error({ t: ['_error:notFoundArgs'], gqlCtx });

    let prevItem = await this.attachmentRepository.findOne({ uuid });
    if (!prevItem) throw msgUtil.error({ t: ['_error:notFoundItem'], gqlCtx });

    prevItem = { ...prevItem, ...args };
    const nextItem = await this.attachmentRepository.save(prevItem);

    loggerUtil.updateLog({ id: uuid, prevItem, nextItem, constructorName: CLS_NAME });

    return nextItem;
  }

  async updateAttachments(attachments: UpdateAttachmentsInput[], gqlCtx?: IGqlCtx): Promise<AttachmentsObject> {
    if (!attachments) throw msgUtil.error({ t: ['_error:notFoundItems'], gqlCtx });

    const batchUpdate = attachments.map(async attachment => {
      await this.attachmentRepository.update({ uuid: attachment.uuid }, _.omit(attachment, ['uuid']));
    });

    let items: Attachment[] = [];

    await Promise.all(batchUpdate)
      .then(async () => {
        loggerUtil.log(JSON.stringify(attachments), CLS_NAME);

        items = await this.attachmentRepository.find({ uuid: In(attachments.map(a => a.uuid)) });
      })
      .catch(() => {
        loggerUtil.error(JSON.stringify(attachments), CLS_NAME);
      });

    return {
      items,
    };
  }

  async deleteAttachments(uuid: string[], gqlCtx?: IGqlCtx): Promise<DeleteAttachmentsObject | undefined> {
    const prevItems = await this.attachmentRepository.find({ uuid: In(uuid) });
    if (!prevItems) throw msgUtil.error({ t: ['_error:notFoundItem'], gqlCtx });

    const nextItem = await this.attachmentRepository.remove(prevItems);
    if (!nextItem) throw msgUtil.error({ t: ['_error:deleteItemFailed'], gqlCtx });

    prevItems.forEach(i => {
      if (i.at2x) {
        try {
          // delete local
          fs.unlinkSync(`${this.configService.PUBLIC_DIR}${pathUtil.getAt2xPath(i.path)}`);

          // delete oss
          loggerUtil.log(`delete local 2x file ${i.path}\n\n`, CLS_NAME);

          if (i.in_oss) {
            this.saveInOssServer.client.delete(attachmentUtil.filenameAt1xToAt2x(i.path.substr(1)));

            loggerUtil.log(`delete oss 2x file ${i.path}\n\n`, CLS_NAME);
          }
        } catch (err) {
          loggerUtil.error(`delete _2x item ${i.path} fail: ${JSON.stringify(i)}\n\n`, CLS_NAME, err);
        }
      }

      try {
        // delete local
        fs.unlinkSync(`${this.configService.PUBLIC_DIR}${i.path}`);
        loggerUtil.log(`delete local 1x file ${i.path}\n\n`, CLS_NAME);

        // delete oss
        if (i.in_oss) {
          this.saveInOssServer.client.delete(i.path.substr(1));

          loggerUtil.log(`delete oss 1x file ${i.path}\n\n`, CLS_NAME);
        }
      } catch (err) {
        loggerUtil.error(`delete file ${i.path} fail: ${JSON.stringify(i)}\n\n`, CLS_NAME, err);
      }
    });

    loggerUtil.log(`delete all-file ${uuid} successful: ${JSON.stringify(nextItem)}\n\n`, CLS_NAME);

    return {
      items: nextItem.map(i => i.uuid),
    };
  }
}
