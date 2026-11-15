// ============================================================
// CV site — supporting infrastructure
// Static Web App (frontend + managed Functions) is created by
// scripts/deploy-infra.sh on first run; this template owns the
// pieces that make the API real: Table Storage + Application
// Insights. Safe to re-run (idempotent).
// ============================================================
targetScope = 'resourceGroup'

@description('Region for all resources')
param location string = resourceGroup().location

@description('Globally unique storage account name (lowercase, 3-24 chars)')
param storageName string = 'stcvsitejk2026'

@description('Application Insights resource name')
param appInsightsName string = 'ai-cv-site'

@description('Tags applied to every resource')
param tags object = {
  project: 'cv-site'
  owner: 'Jonathan Valdes'
  purpose: 'portfolio'
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

resource tableService 'Microsoft.Storage/storageAccounts/tableServices@2023-01-01' = {
  name: 'default'
  parent: storage
}

resource countersTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  name: 'counters'
  parent: tableService
}

resource messagesTable 'Microsoft.Storage/storageAccounts/tableServices/tables@2023-01-01' = {
  name: 'messages'
  parent: tableService
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    RetentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

output storageAccountName string = storage.name
output appInsightsConnectionString string = appInsights.properties.ConnectionString
