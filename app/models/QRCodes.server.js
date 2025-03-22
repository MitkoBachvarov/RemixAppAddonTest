import qrcode from "qrcode";
import invariant from "tiny-invariant";
import db from "../db.server";


/**
 * Gets the QR Code by ID from the DB
 * @param {*} id 
 * @param {*} graphql 
 * @returns QR code
 */
export async function getQRCode(id, graphql) {
    const qrCode = await db.qRCode.findFirst({where: {id}});

    if(!qrCode) return null;

    return supplementQRCode(qrCode, graphql);
}

/**
 * Get all QR for shop
 * @param {*} shop 
 * @param {*} graphql 
 * @returns List of QR objects
 */
export async function getQRCodes(shop, graphql) {
    const qrCodes = await db.qRCode.findMany({
        where: {shop},
        orderBy: {id: "desc"},
    });

    if(qrCodes.length == 0) return [];

    return Promise.all(qrCodes.map((qrCode) => supplementQRCode(qrCode, graphql)));
}

/**
 * Get QR code image from DB 
 * @param {*} id 
 * @returns data URI with the image 
 */
export function getQRCodeImage(id) {
    const url = new URL(`/qrcodes/${id}/scan`, process.env.SHOPIFY_APP_URL);
    return qrcode.toDataURL(url.href);
}

/**
 * Get destination url from qr code
 * @param {*} qrCode 
 * @returns URL pointing to QR code
 */
export function getDestinationUrl(qrCode) {
    if(qrCode.destination === "product") {
        return `https://${qrCode.shop}/products/${qrCode.productHandle}`;
    }

    const match = /gid:\/\/shopify\/ProductVariant\/([0-9]+)/.exec(qrCode.productVariantId);
    invariant(match, "Unrecognized product variant ID");

    return `https://${qrCode.shop}/cart/${match[1]}:1`;
}

async function supplementQRCode(qrCode, graphql) {
    const qrCodeImagePromise = getQRCodeImage(qrCode.id);

    const response = await graphql(
        `
        query supplementQRCode($id: ID!) {
            product(id: $id) {
                title
                media(first:1) {
                    nodes {
                        alt
                        preview {
                            image {
                                altText
                                url
                            }
                        }

                    }
                }
            }
        }
        `,
        {
            variables: {
                id: qrCode.productId,
            },
        }
    );

    const {
        data: {product},
    } = await response.json();

    return {
        ...qrCode,
        productDeleted: !product?.title,
        productTitle: product?.title,
        productImage: product?.images?.nodes[0]?.url,
        productAlt: product?.images?.nodes[0]?.altText,
        destinationUrl: getDestinationUrl(qrCode),
        image: await qrCodeImagePromise
    };
}

/**
 * Validate qr code fullness
 * @param {*} data 
 * @returns Errors if found, otherwise nothing.
 */
export function validateQRCode(data) {
    const errors = {};

    if(!data.title) {
        errors.title = "Title is required";
    }

    if(!data.productId) {
        errors.productId = "Product is required";
    }

    if(!data.destination) {
        errors.destination = "Destination is required";
    }

    if (Object.keys(errors).length) {
        return errors;
    }
}

