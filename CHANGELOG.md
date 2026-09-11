# Changelog

## 0.0.7-alpha

- Multi-tenant HTTP deployments now read Sinch OAuth credentials from `Authorization: Bearer <base64(projectId:keyId:keySecret)>`.
- Updated the HTTP deployment documentation and environment template to describe the `Authorization` credential contract.
- Added tests for valid, missing, and malformed multi-tenant credential headers.
