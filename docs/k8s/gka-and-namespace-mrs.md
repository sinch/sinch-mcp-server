# GKA / namespace follow-ups (DevOps)

GitLab SSO is required to open these MRs. Use this checklist in `#msg-devops`
(and `#ops-eng-common` for merge permission). Reference:
[Infrastructure steps: Creating a New Kubernetes Namespace](https://sinchenterprise.atlassian.net/wiki/spaces/PF/pages/1708752922).

## 0. Unblock namespace MR !3834 (`cg_product`)

Namespace cannot land until `cg_product` exists **and** is allow-listed.

1. Ask Christoffer Jonsson / file TOR (template TOR-17565) for product e.g. `mcp_messaging`.
2. MR to `sinch-platform/infra/flux/add-ons/kyverno-policies` →
   `deploy/policies/require-cg-labels.yaml` allow-list (example: kyverno-policies !322).
3. Rebase / re-run [applications !3834](https://gitlab.com/sinch/sinch-projects/sinch-platform/infra/flux/applications/-/merge_requests/3834).

Proposed labels (align with namespace MR):

```yaml
cg_product:       mcp_messaging
cg_product_id:    0
cg_team:          platform
cg_business_unit: enterprise_messaging
cg_release_state: alpha
cg_product2:      mcp_server
```

## 1. Flux applications — GKA deploy access

Repo: `sinch/sinch-projects/sinch-platform/infra/flux/applications`  
Model: [applications !3159](https://gitlab.com/sinch/sinch-projects/sinch-platform/infra/flux/applications/-/merge_requests/3159) (trust-service)

Add the GitLab project
`product/agent-experience/sinch-mcp-server` so GKA may Helm-deploy into
namespace `mcp-messaging` on `eu1tst-eks001`.

**MR title:** `Allow GKA deploy of sinch-mcp-server into mcp-messaging (eu1tst)`

## 2. gitlab-kubernetes-agent — CI access

Repo: `sinch/sinch-projects/gitlab-kubernetes-agent`  
Model: [agent !112](https://gitlab.com/sinch/sinch-projects/gitlab-kubernetes-agent/-/merge_requests/112) / trust-service !86

Add this project under `ci.access.projects` for site `eu1tst` (and later `us1`).

**MR title:** `ci.access: sinch-mcp-server → eu1tst (mcp-messaging)`

## 3. Verify

After merges, open the GitLab project **Operate → Kubernetes clusters**:
`https://gitlab.com/sinch/sinch-projects/product/agent-experience/sinch-mcp-server/-/clusters`

Expect a live connection to `eu1tst`.

## Slack draft for `#msg-devops`

```text
Hi — Agent Experience is deploying Remote MCP (sinch-mcp-server) to Messaging K8s.

Status:
• Namespace MR: applications !3834 — stuck: new cg_product not allow-listed
• App chart + deploy-helm-gka CI prepared in the service repo (namespace mcp-messaging, eu1tst)
• Need help with:
  1) cg_product allow-list (kyverno-policies) for mcp_messaging (or tell us which existing product to reuse)
  2) GKA access MRs (flux/applications + gitlab-kubernetes-agent) for product/agent-experience/sinch-mcp-server → mcp-messaging @ eu1tst
  3) Confirm deploy-helm-gka@4.9.0 site input flag name for eu1tst (we used `eu1tst: true`)

Thanks!
```
