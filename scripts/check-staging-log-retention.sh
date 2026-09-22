#!/usr/bin/env bash
# RD-229 staging only. Read-only by default; --apply explicitly sets 30 days.
# Uses the existing CloudFormation Lambda physical name; never creates a log group.
set -euo pipefail

if [[ $# -gt 1 || ( $# -eq 1 && "${1}" != '--apply' ) ]]; then
  echo 'Usage: bash scripts/check-staging-log-retention.sh [--apply]' >&2
  exit 2
fi

region='us-east-1'
stack='srco-rd229-staging'
function_name="$(aws cloudformation describe-stack-resource \
  --stack-name "$stack" --logical-resource-id PortalSession \
  --region "$region" --query 'StackResourceDetail.PhysicalResourceId' \
  --output text)"

# Refuse to touch a different function, missing stack, or unexpected result.
if [[ ! "$function_name" =~ ^srco-rd229-staging-PortalSession-[A-Za-z0-9_-]+$ ]]; then
  echo 'STOP: unexpected staging Lambda identity; no changes made.' >&2
  exit 1
fi

log_group="/aws/lambda/${function_name}"
found="$(aws logs describe-log-groups --log-group-name-prefix "$log_group" \
  --region "$region" --query "logGroups[?logGroupName=='$log_group'].logGroupName | [0]" \
  --output text)"
if [[ "$found" != "$log_group" ]]; then
  echo 'STOP: expected existing log group not found; no group created.' >&2
  exit 1
fi

retention() {
  aws logs describe-log-groups --log-group-name-prefix "$log_group" \
    --region "$region" \
    --query "logGroups[?logGroupName=='$log_group'].retentionInDays | [0]" \
    --output text
}
current="$(retention)"
if [[ "$current" == '30' ]]; then
  echo "PASS: existing staging log group has 30-day retention: $log_group"
  exit 0
fi

if [[ "${1:-}" != '--apply' ]]; then
  echo "DRIFT: retention currently '${current}' (expected 30) for $log_group" >&2
  echo 'Read-only check made no changes. Use --apply only after reviewing this identity.' >&2
  exit 1
fi

aws logs put-retention-policy --log-group-name "$log_group" \
  --retention-in-days 30 --region "$region"
verified="$(retention)"
if [[ "$verified" != '30' ]]; then
  echo "FAIL: retention could not be verified (readback '${verified}')." >&2
  exit 1
fi
echo "PASS: 30-day retention verified for $log_group"
