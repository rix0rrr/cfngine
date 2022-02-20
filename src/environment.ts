import { Context } from './evaluate';

export interface EnvironmentOptions {
  readonly region?: string;
  readonly accountId?: string;
  readonly partition?: string;
  readonly urlSuffix?: string;
  readonly exports?: Record<string, string>;
}

export class Environment {
  public static from(options: EnvironmentOptions) {
    return new Environment(options);
  }

  public static default() {
    return new Environment({});
  }

  public readonly region: string;
  public readonly accountId: string;
  public readonly partition: string;
  public readonly urlSuffix: string;
  public readonly exports: Record<string, string>;

  constructor(options: EnvironmentOptions) {
    this.region = options.region ?? 'region-1';
    this.accountId = options.accountId ?? '111111111111';
    this.partition = options.partition ?? 'aws';
    this.urlSuffix = options.urlSuffix ?? 'amazonaws.com';
    this.exports = {};
  }

  public seedContext(context: Context) {
    context.set('AWS::Partition', { primaryValue: this.partition });
    context.set('AWS::AccountId', { primaryValue: this.accountId });
    context.set('AWS::Region', { primaryValue: this.region });
    context.set('AWS::URLSuffix', { primaryValue: this.urlSuffix });
  }

  public setExport(name: string, value: string) {
    this.exports[name] = value;
  }
}
