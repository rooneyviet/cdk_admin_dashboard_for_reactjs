
import { SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import { CloudFormationCreateUpdateStackAction, CodeBuildAction, GitHubSourceAction } from 'aws-cdk-lib/aws-codepipeline-actions';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CicdReactAdminDashboardPipelineStack extends Stack {

    private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly serviceBuildOutput: Artifact;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.pipeline = new Pipeline(this, "Pipeline",{
      pipelineName: "ReactAdminDashboardPipeline",
      crossAccountKeys: false,
      restartExecutionOnUpdate: true
    });

    const cdkSourceOutput = new Artifact("CDKSourceOutput");
    const serviceSourceOutput = new Artifact("ServiceSourceOutput");

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
          output: serviceSourceOutput
        })
      ]
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
          project: new PipelineProject(this, "ServiceBuildProject",{
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0
            },
            buildSpec: BuildSpec.fromSourceFilename('build-specs/service-build-specs.yml')
          })
        })
      ]
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
    }
}