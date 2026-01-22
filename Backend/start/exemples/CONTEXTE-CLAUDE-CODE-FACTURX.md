# Contexte pour Claude Code - Génération Factur-X

## Objectif du projet

Je développe une API avec AdonisJS 6 qui :
1. Reçoit un PDF de facture + les données de la facture (JSON)
2. Génère un XML au format Factur-X (norme CII)
3. Embarque le XML dans le PDF pour créer un PDF Factur-X conforme
4. Retourne le PDF Factur-X

## Ce dont j'ai besoin

Je veux que tu génères **uniquement** le service de génération XML Factur-X.

Le service doit :
- Prendre un objet `InvoiceData` en entrée
- Retourner une string XML conforme au format Factur-X profil MINIMUM (ou BASIC si tu préfères)
- Utiliser la librairie `xmlbuilder2` déjà installée

## Librairies déjà installées

```json
{
  "xmlbuilder2": "^4.0.3",
  "pdf-lib": "dernière version",
  "pdf-parse": "dernière version"
}
```

## Structure du projet AdonisJS 6

```
app/
├── services/
│   └── xml_generator_service.ts   <-- À GÉNÉRER
├── types/
│   └── InvoiceData.ts             <-- Existe déjà (voir ci-dessous)
```

## Interface InvoiceData (existante)

```typescript
// app/types/InvoiceData.ts

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  sellerSiret: string
  sellerAddress: {
    street: string
    zipCode: string
    city: string
    country: string
  }
  buyerName: string
  buyerSiret: string
  buyerAddress: {
    street: string
    zipCode: string
    city: string
    country: string
  }
  currencyCode: string
  totalHT: string
  totalTVA: string
  totalTTC: string
}
```

**Note** : Tu peux modifier cette interface si tu as besoin de champs supplémentaires pour être conforme Factur-X (ex: numéro TVA, code pays ISO, etc.). Dans ce cas, fournis-moi la nouvelle interface.

## Exemple de XML Factur-X attendu (profil Minimum)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice 
    xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100"
    xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
    xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
    xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
    
    <rsm:ExchangedDocumentContext>
        <ram:BusinessProcessSpecifiedDocumentContextParameter>
            <ram:ID>A1</ram:ID>
        </ram:BusinessProcessSpecifiedDocumentContextParameter>
        <ram:GuidelineSpecifiedDocumentContextParameter>
            <ram:ID>urn:factur-x.eu:1p0:minimum</ram:ID>
        </ram:GuidelineSpecifiedDocumentContextParameter>
    </rsm:ExchangedDocumentContext>
    
    <rsm:ExchangedDocument>
        <ram:ID>F-2024-001</ram:ID>
        <ram:TypeCode>380</ram:TypeCode>
        <ram:IssueDateTime>
            <udt:DateTimeString format="102">20240115</udt:DateTimeString>
        </ram:IssueDateTime>
    </rsm:ExchangedDocument>
    
    <rsm:SupplyChainTradeTransaction>
        
        <ram:ApplicableHeaderTradeAgreement>
            
            <ram:SellerTradeParty>
                <ram:Name>Ma Société SARL</ram:Name>
                <ram:SpecifiedLegalOrganization>
                    <ram:ID schemeID="0002">12345678901234</ram:ID>
                </ram:SpecifiedLegalOrganization>
                <ram:PostalTradeAddress>
                    <ram:CountryID>FR</ram:CountryID>
                </ram:PostalTradeAddress>
                <ram:SpecifiedTaxRegistration>
                    <ram:ID schemeID="VA">FR12345678901</ram:ID>
                </ram:SpecifiedTaxRegistration>
            </ram:SellerTradeParty>
            
            <ram:BuyerTradeParty>
                <ram:Name>Client Entreprise SA</ram:Name>
                <ram:SpecifiedLegalOrganization>
                    <ram:ID schemeID="0002">98765432109876</ram:ID>
                </ram:SpecifiedLegalOrganization>
            </ram:BuyerTradeParty>
            
        </ram:ApplicableHeaderTradeAgreement>
        
        <ram:ApplicableHeaderTradeDelivery/>
        
        <ram:ApplicableHeaderTradeSettlement>
            <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
            
            <ram:SpecifiedTradeSettlementHeaderMonetarySummation>
                <ram:TaxBasisTotalAmount>1000.00</ram:TaxBasisTotalAmount>
                <ram:TaxTotalAmount currencyID="EUR">200.00</ram:TaxTotalAmount>
                <ram:GrandTotalAmount>1200.00</ram:GrandTotalAmount>
                <ram:DuePayableAmount>1200.00</ram:DuePayableAmount>
            </ram:SpecifiedTradeSettlementHeaderMonetarySummation>
            
        </ram:ApplicableHeaderTradeSettlement>
        
    </rsm:SupplyChainTradeTransaction>
    
</rsm:CrossIndustryInvoice>
```

## Informations techniques importantes

### Namespaces Factur-X
```typescript
const namespaces = {
  qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
  ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
  rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
  udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100'
}
```

### Format de date
La date doit être au format `YYYYMMDD` (format "102" dans la norme CII).
Exemple : `2024-01-15` → `20240115`

### TypeCode pour les factures
- `380` = Facture commerciale
- `381` = Avoir

### SchemeID pour les identifiants
- `0002` = SIRET (France)
- `VA` = Numéro de TVA intracommunautaire

## Livrables attendus

1. **Service `XmlGeneratorService`** complet et fonctionnel
2. **Interface `InvoiceData`** mise à jour si nécessaire
3. **Commentaires** dans le code pour expliquer la structure XML

## Contraintes

- Code en TypeScript
- Compatible AdonisJS 6 (ESM modules)
- Utiliser `xmlbuilder2` pour la génération XML
- Le XML généré doit être valide selon le schéma Factur-X

## ⚠️ IMPORTANT - NE PAS TOUCHER

**Tu ne dois PAS créer ou modifier :**
- Les controllers
- Les routes
- Les validators
- Les middlewares
- La logique métier / business logic
- L'authentification
- Quoi que ce soit d'autre dans AdonisJS

**Tu fais UNIQUEMENT :**
- Le service `XmlGeneratorService` (génération XML Factur-X)
- Le service `PdfEmbedderService` (embarquer XML dans PDF)
- Les types/interfaces nécessaires pour ces services

La logique applicative, c'est MOI qui la fais. Toi, tu me fournis juste les briques techniques pour Factur-X.

## Bonus (si possible)

- Un service `PdfEmbedderService` qui utilise `pdf-lib` pour embarquer le XML dans un PDF et retourner un PDF Factur-X conforme (PDF/A-3)
