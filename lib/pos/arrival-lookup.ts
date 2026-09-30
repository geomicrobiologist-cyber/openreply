/**
 * Server-to-server client for the POS's IG-triggered arrival lookup endpoint.
 * Lets a DM keyword automation reply with the customer's actual order status
 * instead of a static link, when the sender's IG username matches a
 * customer record on file (customer.ig_name). Optional feature — both env
 * vars are unset by default, and callers must treat a null return as "fall
 * back to the static campaign message," not as an error.
 */

export interface ArrivalItem {
  productName: string;
  num: number;
  productStatus: string;
  expectedArrivalDate: string | null;
}

export async function lookupArrivalStatusByIgName(
  igUsername: string
): Promise<ArrivalItem[] | null> {
  const baseUrl = process.env.POS_ARRIVAL_API_URL;
  const apiKey = process.env.POS_ARRIVAL_API_KEY;
  if (!baseUrl || !apiKey) return null;

  const url = new URL(baseUrl);
  url.searchParams.set("igName", igUsername);
  url.searchParams.set("apiKey", apiKey);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (data?.status !== 200 || !Array.isArray(data?.result)) return null;

    return data.result as ArrivalItem[];
  } catch {
    return null;
  }
}

/**
 * Render the looked-up items as the DM reply text. Items are already sorted
 * by the POS (undelivered first, then by expected date).
 */
export function formatArrivalMessage(items: ArrivalItem[]): string {
  if (items.length === 0) {
    return "您好～目前查無您的預購商品紀錄，如有疑問歡迎直接留言詢問客服 🙂";
  }

  const lines = items.map((item) => {
    if (item.productStatus === "未到貨") {
      const eta = item.expectedArrivalDate
        ? new Date(item.expectedArrivalDate).toLocaleDateString("zh-TW")
        : "未定";
      return `・${item.productName} x${item.num}｜未到貨（預計 ${eta}）`;
    }
    return `・${item.productName} x${item.num}｜${item.productStatus}`;
  });

  return `您好～您預購商品的到貨進度：\n\n${lines.join("\n")}\n\n如有其他問題歡迎直接留言詢問客服 🙂`;
}
