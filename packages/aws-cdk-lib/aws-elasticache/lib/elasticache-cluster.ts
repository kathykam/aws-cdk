import { Construct } from 'constructs';
import * as elasticache from './elasticache.generated';
import * as ec2 from '../aws-ec2';
import * as kms from '../aws-kms';
import { Resource, ResourceProps, Tags, Duration, IResolvable } from '../core';

export enum CacheEngine {
  REDIS = 'redis',
  MEMCACHED = 'memcached'
}

export enum CacheClusterStatus {
  AVAILABLE = 'available',
  CREATING = 'creating',
  DELETED = 'deleted',
  DELETING = 'deleting',
  INCOMPATIBLE_NETWORK = 'incompatible-network',
  MODIFYING = 'modifying',
  REBOOTING_CLUSTER_NODES = 'rebooting-cluster-nodes',
  RESTORE_FAILED = 'restore-failed',
  SNAPSHOTTING = 'snapshotting'
}

export interface ElastiCacheClusterProps {
  /**
   * The VPC where the cache cluster will be deployed.
   */
  readonly vpc: ec2.IVpc;

  /**
   * The name of the cache engine to be used for this cache cluster.
   */
  readonly engine: CacheEngine;

  /**
   * The compute and memory capacity of the nodes in the cache cluster.
   * @see https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/CacheNodes.SupportedTypes.html
   */
  readonly cacheNodeType: string;

  /**
   * The number of cache nodes in the cache cluster.
   */
  readonly numCacheNodes: number;

  /**
   * A name for the cache cluster. If you don't specify a name, AWS CloudFormation generates a unique physical ID and uses that ID for the cache cluster.
   * @default - AWS CloudFormation generated name
   */
  readonly clusterName?: string;

  /**
   * The version number of the cache engine.
   * @default - latest version
   */
  readonly engineVersion?: string;

  /**
   * The port number on which the cache accepts connections.
   * @default - 6379 for Redis, 11211 for Memcached
   */
  readonly port?: number;

  /**
   * The subnet group where the cache cluster will be placed.
   * @default - a new subnet group will be created
   */
  readonly subnetGroup?: elasticache.CfnSubnetGroup;

  /**
   * The security groups to assign to the cache cluster.
   * @default - a new security group will be created
   */
  readonly securityGroups?: ec2.ISecurityGroup[];

  /**
   * The name of the parameter group to associate with this cache cluster.
   * @default - the default parameter group for the specified engine
   */
  readonly cacheParameterGroupName?: string;

  /**
   * Indicates that minor engine upgrades will be applied automatically to the cache cluster during the maintenance window.
   * @default true
   */
  readonly autoMinorVersionUpgrade?: boolean;

  /**
   * Specifies whether the nodes in this Memcached cluster are created in a single Availability Zone or created across multiple Availability Zones in the cluster's region.
   * @default - single Availability Zone
   */
  readonly azMode?: string;

  /**
   * The EC2 Availability Zone in which the cache cluster is created.
   * @default - random Availability Zone in the region
   */
  readonly preferredAvailabilityZone?: string;

  /**
   * A list of the Availability Zones in which cache nodes are created.
   * @default - Availability Zones are automatically chosen
   */
  readonly preferredAvailabilityZones?: string[];

  /**
   * The weekly time range (in UTC) during which system maintenance can occur.
   * @default - 60-minute window selected at random from an 8-hour block of time per region, occurring on a random day of the week
   */
  readonly preferredMaintenanceWindow?: string;

  /**
   * The Amazon Resource Name (ARN) of the Amazon Simple Notification Service (SNS) topic to which notifications are sent.
   * @default - no notifications are sent
   */
  readonly notificationTopicArn?: string;

  /**
   * A list of Amazon Resource Names (ARN) that uniquely identify the Redis RDB snapshot files stored in Amazon S3. The snapshot files are used to populate the new cache cluster.
   * @default - cache cluster is not created from a snapshot
   */
  readonly snapshotArns?: string[];

  /**
   * The name of a Redis snapshot from which to restore data into the new cache cluster.
   * @default - cache cluster is not created from a snapshot
   */
  readonly snapshotName?: string;

  /**
   * The number of days for which ElastiCache retains automatic snapshots before deleting them.
   * @default - 0 (automatic backups are disabled)
   */
  readonly snapshotRetentionLimit?: number;

  /**
   * The daily time range (in UTC) during which ElastiCache begins taking a daily snapshot of your cache cluster.
   * @default - 60-minute window selected at random from an 8-hour block of time per region
   */
  readonly snapshotWindow?: string;

  /**
   * An array of key-value pairs to apply to this cache cluster.
   * @default - no tags
   */
  readonly tags?: { [key: string]: string };

  /**
   * Specifies whether encryption is enabled for the cache cluster.
   * @default - encryption is disabled
   */
  readonly encryption?: {
    /**
     * Indicates whether to enable encryption at rest.
     */
    atRest: boolean;
    /**
     * Indicates whether to enable encryption in transit.
     */
    inTransit: boolean;
    /**
     * The KMS key to use for encryption.
     * @default - AWS owned CMK
     */
    kmsKey?: kms.IKey;
  };

  /**
   * Specifies the backup configuration for the cache cluster.
   * @default - no backups
   */
  readonly backups?: {
    /**
     * The number of days for which ElastiCache retains automatic snapshots before deleting them.
     */
    retention: Duration;
    /**
     * The daily time range during which automated backups are created.
     * @default - 60-minute window selected at random from an 8-hour block of time per region
     */
    preferredWindow?: string;
  };
}


export class ElastiCacheCluster extends Resource {
  public readonly cluster: elasticache.CfnCacheCluster;
  public readonly connections: ec2.Connections;
  private readonly securityGroup: ec2.ISecurityGroup;

  constructor(scope: Construct, id: string, props: ElastiCacheClusterProps) {
    super(scope, id);

    const port = props.port ?? (props.engine === CacheEngine.REDIS ? 6379 : 11211);

    this.securityGroup = props.securityGroups?.[0] ?? new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for ElastiCache cluster',
      allowAllOutbound: true,
    });

    const subnetGroup = props.subnetGroup ?? new elasticache.CfnSubnetGroup(this, 'SubnetGroup', {
      description: 'Subnet group for ElastiCache cluster',
      subnetIds: props.vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
    });

    this.cluster = new elasticache.CfnCacheCluster(this, 'Resource', {
      clusterName: props.clusterName,
      engine: props.engine,
      engineVersion: props.engineVersion,
      cacheNodeType: props.cacheNodeType,
      numCacheNodes: props.numCacheNodes,
      port,
      cacheSubnetGroupName: subnetGroup.ref,
      vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
      cacheParameterGroupName: props.cacheParameterGroupName,
      autoMinorVersionUpgrade: props.autoMinorVersionUpgrade,
      azMode: props.azMode,
      preferredAvailabilityZone: props.preferredAvailabilityZone,
      preferredAvailabilityZones: props.preferredAvailabilityZones,
      preferredMaintenanceWindow: props.preferredMaintenanceWindow,
      notificationTopicArn: props.notificationTopicArn,
      snapshotArns: props.snapshotArns,
      snapshotName: props.snapshotName,
      snapshotRetentionLimit: props.snapshotRetentionLimit,
      snapshotWindow: props.snapshotWindow,
    });

    if (props.encryption) {
      this.cluster.atRestEncryptionEnabled = props.encryption.atRest;
      this.cluster.transitEncryptionEnabled = props.encryption.inTransit;
      if (props.encryption.kmsKey) {
        this.cluster.kmsKeyId = props.encryption.kmsKey.keyId;
      }
    }

    if (props.backups) {
      this.cluster.snapshotRetentionLimit = props.backups.retention.toDays();
      if (props.backups.preferredWindow) {
        this.cluster.snapshotWindow = props.backups.preferredWindow;
      }
    }

    if (props.tags) {
      Object.entries(props.tags).forEach(([key, value]) => {
        Tags.of(this).add(key, value);
      });
    }

    this.connections = new ec2.Connections({
      securityGroups: [this.securityGroup],
      defaultPort: ec2.Port.tcp(port),
    });
  }

  public allowConnectionsFrom(other: ec2.IConnectable, port?: ec2.Port) {
    other.connections.allowTo(this, port);
  }

  public addReadReplica(id: string, props: { 
    numCacheNodes?: number, 
    region?: string 
  }) {
    // Placeholder for read replica implementation
  }

  public get clusterStatus(): string | IResolvable {
    return this.cluster.attrCacheClusterStatus;
  }

  public get configurationEndpoint(): string | IResolvable {
    return this.cluster.attrConfigurationEndpoint;
  }

  public get redisEndpoint(): string | IResolvable {
    return this.cluster.attrRedisEndpointAddress;
  }

  public get redisPort(): string | IResolvable {
    return this.cluster.attrRedisEndpointPort;
  }
}
