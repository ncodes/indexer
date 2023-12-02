import { BadgeManifest, parseBadgeLocals } from '@jointlabs/chains-info';
import { Controller, Get, Logger, Param, Query, ValidationPipe } from '@nestjs/common';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { ok, throw404 } from '../../common/responses/responses';
import Badge from '../../models/badge';
import BadgeGrant from '../../models/badge_grant';
import { BadgeService } from './badge.service';
import { ListBadgesQueryDTO, ListGrantedBadgesQueryDTO } from './query.dto';

@Controller('v1/badges')
export class BadgesController {
  private logger = new Logger(BadgesController.name);

  constructor(private badgeSrv: BadgeService) {}

  /**
   * List badges
   * @param q The query object
   * @param q.network The network name
   * @param [q.badge] Filter by the badge name
   * @param [q.path] Filter by the badge path
   * @param [q.issuer] Filter by the issuer address
   * @param [q.coIssuer] Filter by the co-issuer address
   * @param [q.count] Returns only the count of matching result
   * @param [q.select] Select fields to return
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   */
  @Get()
  async listBadges(@Query(new ValidationPipe(ValPipeOpt)) q: ListBadgesQueryDTO) {
    const result = await Badge.search(
      q.net,
      q.issuer,
      q.coIssuer,
      q.badge,
      q.path,
      q.count,
      q.limit,
      q.offset,
      q.select,
    );

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const badges = result as Badge[];
    for (const badge of badges) {
      await this.badgeSrv.extendBadge(badge, q.select).catch((e) => {
        this.logger.error(e, null, 'list()');
      });
    }

    return ok().data(badges).build();
  }

  /**
   * List granted badges
   * @param q The query object
   * @param q.network The network name
   * @param [q.badge] Filter by the badge name
   * @param [q.path] Filter by the badge path
   * @param [q.grantee] Filter by the grantee address
   * @param [q.count] Returns only the count of matching result
   * @param [q.select] Select fields to return
   * @param [q.limit] The number of result to return
   * @param [q.offset] The query offset
   */
  @Get('granted')
  async listGrantedBadges(@Query(new ValidationPipe(ValPipeOpt)) q: ListGrantedBadgesQueryDTO) {
    const result = await BadgeGrant.search(q.net, q.badge, q.path, q.grantee, q.count, q.limit, q.offset, q.select);

    if (q.count) {
      return ok().data({ count: result }).build();
    }

    const grants = result as BadgeGrant[];
    for (const grant of grants) {
      await this.badgeSrv.extendBadgeGrant(grant, q.select).catch((e) => {
        this.logger.error(e, null, 'list()');
      });
    }

    return ok().data(grants).build();
  }

  /**
   * Get the manifest information about a badge.
   * Manifest contains information about a badge, the issuer and
   * information required by the client to grant, manage and revoke the badge.
   * @param net The network name
   * @param badge The badge name
   * @returns
   */
  @Get('/:net/:badge((([\\w-]+)(/[\\w-]+)?))/manifest')
  async getBadgeManifest(@Param('net') net: string, @Param('badge') badge: string) {
    const netManifests = BadgeManifest[net];
    if (!netManifests) throw404(`no manifest found for '${net}'`);

    let manifest: BadgeManifest;
    for (const key in netManifests) {
      if (badge.match(new RegExp(key))) {
        manifest = netManifests[key];
      }
    }

    if (!manifest) throw404(`no manifest found for '${badge}'`);

    return ok().data(parseBadgeLocals(manifest, { badge })).build();
  }
}
