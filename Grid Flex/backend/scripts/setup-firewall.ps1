param(
  [Parameter(Mandatory = $false)]
  [int]$HttpsPort = 4443,

  [Parameter(Mandatory = $false)]
  [string]$AllowedRemoteAddresses = "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16",

  [Parameter(Mandatory = $false)]
  [switch]$AllowLocalhostOnly
)

$ErrorActionPreference = "Stop"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
  )) {
  throw "Run this script as Administrator."
}

$rulePrefix = "GridFlex Admin HTTPS"
$allowRuleName = "$rulePrefix Allow"
$blockRuleName = "$rulePrefix Block"

Get-NetFirewallRule -DisplayName $allowRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName $blockRuleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule -ErrorAction SilentlyContinue

$remoteAddresses = if ($AllowLocalhostOnly) { "127.0.0.1,::1" } else { $AllowedRemoteAddresses }

New-NetFirewallRule `
  -DisplayName $allowRuleName `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort $HttpsPort `
  -RemoteAddress $remoteAddresses `
  -Profile Domain,Private

New-NetFirewallRule `
  -DisplayName $blockRuleName `
  -Direction Inbound `
  -Action Block `
  -Protocol TCP `
  -LocalPort $HttpsPort `
  -RemoteAddress Any `
  -Profile Any

Write-Host "Firewall rules applied for HTTPS port $HttpsPort"
Write-Host "Allowed sources: $remoteAddresses"
