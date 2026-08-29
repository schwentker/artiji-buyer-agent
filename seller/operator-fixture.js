export function createOperatorFixture({ seller }) {
  return {
    publishArtifact({ taskId, id, url, orderReference }) {
      return seller.completeTask(taskId, { id, url, orderReference });
    }
  };
}
