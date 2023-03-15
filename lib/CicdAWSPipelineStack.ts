import { ApplicationProtocol, SslPolicy } from 'aws-cdk-lib/aws-elasticloadbalancingv2';

import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { ServerApplication, ServerDeploymentConfig, ServerDeploymentGroup } from 'aws-cdk-lib/aws-codedeploy';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, CodeDeployServerDeployAction, GitHubSourceAction, GitHubTrigger } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from 'aws-cdk-lib/aws-iam'
import { ApplicationLoadBalancer, ListenerCertificate } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { AutoScalingGroup, HealthCheck } from 'aws-cdk-lib/aws-autoscaling';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CicdReactAdminDashboardPipelineStack extends Stack {

    private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;
  readonly loadBalancer: ApplicationLoadBalancer;
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.pipeline = new Pipeline(this, "Pipeline",{
      pipelineName: "ReactAdminDashboardPipeline",
      crossAccountKeys: false,
      restartExecutionOnUpdate: true
    });

    const cdkSourceOutput = new Artifact("CDKSourceOutput");
    const serviceSourceOutput = new Artifact("ServiceSourceOutput");
    this.pipeline.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
    )
    this.pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          owner: "rooneyviet",
          repo: "cdk_admin_dashboard_for_reactjs",
          branch: "master",
          actionName: "CDK_Source",
          oauthToken: SecretValue.secretsManager('github-pipeline2'),
          output: cdkSourceOutput
        }),
        new GitHubSourceAction({
          owner: "rooneyviet",
          repo: "reactjs-admin-dashboard-demo",
          branch: "master",
          actionName: "Service_Source",
          oauthToken: SecretValue.secretsManager('github-pipeline2'),
          output: serviceSourceOutput,
          trigger: GitHubTrigger.WEBHOOK,
        })
      ],
    });

    this.cdkBuildOutput = new Artifact("CdkBuildOuput");
    this.serviceBuildOutput = new Artifact("ServiceBuildOuput");
    this.pipeline.addStage({
      stageName: "Build",
      actions:[
        new CodeBuildAction({
          actionName: "CDK_Build",
          input: cdkSourceOutput,
          outputs: [this.cdkBuildOutput],
          project: new PipelineProject(this, "CdkBuildProject",{
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0
            },
            buildSpec: BuildSpec.fromSourceFilename('build-specs/cdk-build-specs.yml')
          })
        }),
        new CodeBuildAction({
          actionName: "Service_Build",
          input: serviceSourceOutput,
          outputs: [this.serviceBuildOutput],
          project: new PipelineProject(this, "ServiceReactBuildProject",{
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0
            },
            buildSpec: BuildSpec.fromSourceFilename('build-specs/service-build-specs.yml')
          })
        })
      ]
    });

    


    ///


    const vpc = new ec2.Vpc(this, 'VPC');
    // Allow SSH (TCP Port 22) access from anywhere
    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc,
      description: 'Allow SSH (TCP port 22) in',
      allowAllOutbound: true
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access')
    securityGroup.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.allTraffic());
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(3000), 'Server web')

      this.loadBalancer = new ApplicationLoadBalancer(this, `ApplicationLoadBalancerPublic`, {
        vpc,
        internetFacing: true,
        securityGroup: securityGroup
      })

    const role = new iam.Role(this, 'ec2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
    })

    //role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'))
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess'))

    
    //const userData1 = ec2.UserData.forLinux();

    //var bootscript:string;
    //bootscript = fs.readFileSync('lib/src/config.sh','utf8');

  
    const autoScalingGroup = new AutoScalingGroup(this, 'AutoScalingGroup', {
        vpc, 
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        machineImage: new ec2.AmazonLinuxImage(), 
        allowAllOutbound: true,
        role: role,
        minCapacity:1,
        maxCapacity:2,
        desiredCapacity:1,
        //healthCheck: HealthCheck.ec2(),
        associatePublicIpAddress: true,
        //userData: userData1,
        vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      });
      autoScalingGroup.addSecurityGroup(securityGroup);
      
    
      //autoScalingGroup.addUserData(bootscript);

      const httpsListener = this.loadBalancer.addListener('ALBListenerHttps', {
        certificates: [ListenerCertificate.fromArn("arn:aws:acm:us-east-1:182854672749:certificate/736c3301-4f8e-4503-a2fc-2f980b3ceb3f")],
        protocol: ApplicationProtocol.HTTPS,
        port: 443,
        sslPolicy: SslPolicy.TLS12
      })

    httpsListener.addTargets('TargetGroup', {
        port: 80,
        protocol: ApplicationProtocol.HTTP,
        targets: [autoScalingGroup], 
        // healthCheck: {
        //   path: "/",
        //   port: "80",
        //   healthyHttpCodes: "200"
        // }
      })
    const application = new ServerApplication(this, 'CodeDeployApplication', {
      applicationName: 'MyApplication', // optional property
    });


    const codedeployrole = new iam.Role(this, 'codedeployrole', {
      assumedBy: new iam.ServicePrincipal('codedeploy.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess')
      ]
      //roleName:" CodeDeployServiceRole",
    })


    const deploymentGroup = new ServerDeploymentGroup(this, 'DeploymentGroup', {
      application,
      deploymentGroupName: 'DeploymentGroup',
      autoScalingGroups: [autoScalingGroup],
      // adds User Data that installs the CodeDeploy agent on your auto-scaling groups hosts
      // default: true
      installAgent: true,
      // auto-rollback configuration
    
      deploymentConfig: ServerDeploymentConfig.ALL_AT_ONCE,
      autoRollback: {
        failedDeployment: false,
        stoppedDeployment: false,
      },
      role: codedeployrole
      
    });

    //this.pipeline.role.addManagedPolicy(
      //iam.ManagedPolicy.fromAwsManagedPolicyName("AdministratorAccess")
      //)


    const deployAction = new CodeDeployServerDeployAction({
      actionName: 'CodeDeploy',
      input: this.serviceBuildOutput,
      deploymentGroup: deploymentGroup,
      //role:codedeployrole
    });


    this.pipeline.addStage({
      stageName: "Pipeline_Update",
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: "Pipeline_Update",
          stackName: "CicdReactAdminDashboardPipelineStack",
          templatePath: this.cdkBuildOutput.atPath("CicdReactAdminDashboardPipelineStack.template.json"),
          adminPermissions: true,
        }),
      ],
    });

    this.pipeline.addStage({
      stageName: "Deploy",
      actions:[deployAction]
    });
    }
}