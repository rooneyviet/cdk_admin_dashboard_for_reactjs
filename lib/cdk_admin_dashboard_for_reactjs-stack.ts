import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Ec2CdkStack } from './ec2-cdk-stack';
import { ARecord, HostedZone, RecordTarget } from 'aws-cdk-lib/aws-route53';
import { LoadBalancerTarget } from 'aws-cdk-lib/aws-route53-targets';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkAdminDashboardForReactjsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkAdminDashboardForReactjsQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });


    const app = new Ec2CdkStack(this, 'EC2Test', {
      //CertificateArn: "rn:aws:acm:us-east-1:123456789:certificate/be12312-ecad-3123-1231s-123ias9123",
      //InstancePort: 80,
      //HealthCheckPath: "/",
      //HealthCheckPort: "80",
      //HealthCheckHttpCodes: "200"
    })

    const route53_hosted_zone = HostedZone.fromLookup(this, 'MyZone', {
      domainName: 'kakiandmai.com'
    })

    new ARecord(this, 'AliasRecord', {
      zone: route53_hosted_zone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(app.loadBalancer)),
      recordName: 'dashboardreact.kakiandmai.com'
    })
  }
}
