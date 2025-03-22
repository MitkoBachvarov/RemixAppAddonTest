import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Link,
  InlineStack,
  EmptyState,
  IndexTable,
  Thumbnail,
  Icon,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getQRCodes } from "../models/QRCodes.server";
import {AlertDiamondIcon, ImageIcon} from "@shopify/polaris-icons";
import { useEffect, useState } from "react";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql);
  
  return {qrCodes};
};

const EmptyQrCodeState = ({onAction}) => {
  <EmptyState
    heading="Create unique QR codes for your product"
    action={ {
      content: "Create QR code",
      onAction
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Allow customers to scan codes and buy products using their phones</p>
    </EmptyState>
}

function truncate(str, {length = 25} = {}) {
  if(!str) return "";
  if(str.length <= length) return str;
  return str.slice(0, length) + "_";
}

const ClientOnlyIndexTable = ({items}) => {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if(!isClient) return <Card>Loading table...</Card>

  return (
    <Card>
      <Text as={"h1"}>Qr codes: </Text>
      <QRTable qrCodes={items} />
    </Card>
  )
}

const QRTable = ({qrCodes}) => (
    <IndexTable
    resourceName={{
      singular: "QR code",
      plural: "QR codes"
    }}
    itemCount={qrCodes.length}
    headings={[
      {title: "Thumbnail", hidden: true},
      {title: "Title"},
      {title:"Product"},
      {title:"Date created"},
      {title:"Scans"},
    ]}
    selectable={false}
    >
      {qrCodes.map((qrCode) => (
        <QRTableRow key={qrCode.id} qrCode={qrCode} />
      ))}
    </IndexTable>
)

const QRTableRow = ({qrCode}) => (
  <IndexTable.Row id={qrCode.id} position={qrCode.id}>
    <IndexTable.Cell>
      <Thumbnail
        source={qrCode.productImage || ImageIcon}
        alt={qrCode.productTitle}
        size="small"
        />
    </IndexTable.Cell>
    <IndexTable.Cell>
      <Link to={`app/qrcodes/${qrCode.id}`} url={`qrcodes/${qrCode.id}`}>
        {truncate(qrCode.title)}
      </Link>
    </IndexTable.Cell>
    <IndexTable.Cell>
      {qrCode.productDeleted ? (
        <InlineStack align="start" gap="200">
          <span style={{width: "20px"}}>
            <Icon source={AlertDiamondIcon} tone="critical" />
          </span>
          <Text tone="critical" as="span"> product has been deleted</Text>
        </InlineStack>
      ) : (
        truncate(qrCode.productTitle)
      )}
    </IndexTable.Cell>
    <IndexTable.Cell>
      {new Date(qrCode.createdAt).toDateString()}
    </IndexTable.Cell>
    <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
  </IndexTable.Row>
)

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const {qrCodes} = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page>
      <ui-title-bar title="QR Codes">
        <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
          Create QR Code
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {qrCodes === undefined || qrCodes.length == 0 ? (
              <Card> 
                <Text as={"h2"}>Welcome</Text>
                <EmptyQrCodeState onAction={() => navigate("/qrcodes/new")} />                
              </Card>
            ): (
              <ClientOnlyIndexTable items={qrCodes} />
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
