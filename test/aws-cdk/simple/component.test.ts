import { CreateECR } from "./component";
import { cdkSpec as cloud, createTestApp } from "@hekto/cloud-spec-aws-cdk";
import { CfnOutput } from "aws-cdk-lib";
import { SFNClient, StartSyncExecutionCommand } from "@aws-sdk/client-sfn";
import { ECRClient, DeleteRepositoryCommand } from "@aws-sdk/client-ecr";

const sfnClient = new SFNClient({});
const ecrClient = new ECRClient({});

const testApp = createTestApp({
  creator: (stack) => {
    const component = new CreateECR(stack, "Repository");

    new CfnOutput(stack, "SfnArn", {
      value: component.sfn.stateMachineArn,
    });
  },
});

describe("Repository", () => {
  cloud.setup({
    testApp,
  });

  cloud.test(
    "should be defined",
    async (stackOutputs) => {
      const sfnArn = stackOutputs[testApp.stackName].SfnArn;

      expect(sfnArn).toEqual(expect.stringMatching(/^arn:aws:states:/));
    },
    300_000
  );

  cloud.test(
    "invokes stepfunction which creates ECR repository",
    async (stackOutputs) => {
      const sfnArn = stackOutputs[testApp.stackName].SfnArn;
      const randomPostFix = Math.random().toString(36).substring(7);

      const repositoryName = `skorfmann/foo-${randomPostFix}`;
      try {
        const result = await sfnClient.send(
          new StartSyncExecutionCommand({
            stateMachineArn: sfnArn,
            input: JSON.stringify({
              repositoryName,
            }),
          })
        );

        expect(result.status).toEqual("SUCCEEDED");
      } finally {
        await ecrClient.send(
          new DeleteRepositoryCommand({
            repositoryName,
          })
        );
      }
    },
    300_000
  );
});