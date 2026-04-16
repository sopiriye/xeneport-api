import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SearchSecuritiesQueryDto } from './dto/search-securities-query.dto';
import { SecuritiesService } from './securities.service';

@ApiTags('Securities')
@Controller('securities')
export class SecuritiesController {
  constructor(private readonly securitiesService: SecuritiesService) {}

  @Get('search')
  @ApiOperation({
    summary: 'Search predefined securities',
    description:
      'Returns the predefined stock list that holdings are allowed to reference.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Optional ticker or company-name search term.',
    example: 'GTCO',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results to return.',
    example: 10,
  })
  @ApiOkResponse({
    description: 'Security search completed successfully.',
  })
  search(@Query() query: SearchSecuritiesQueryDto) {
    return this.securitiesService.search(query);
  }

  @Get(':ticker')
  @ApiOperation({
    summary: 'Get predefined security by ticker',
    description: 'Returns a single predefined security by its ticker symbol.',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Security ticker symbol.',
    example: 'GTCO',
  })
  @ApiOkResponse({
    description: 'Security returned successfully.',
  })
  @ApiNotFoundResponse({ description: 'Security was not found.' })
  findByTicker(@Param('ticker') ticker: string) {
    return this.securitiesService.findByTicker(ticker);
  }
}
