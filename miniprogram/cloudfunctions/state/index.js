const cloud = require("wx-server-sdk");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const STATE_COLLECTION = "app_states";
const STATE_DOC_ID = "main";

function cleanForCloud(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanForCloud(item)).filter((item) => item !== undefined);
  }
  if (value && typeof value === "object") {
    return Object.keys(value).reduce((result, key) => {
      const cleanedValue = cleanForCloud(value[key]);
      if (cleanedValue !== undefined) result[key] = cleanedValue;
      return result;
    }, {});
  }
  if (typeof value === "undefined" || typeof value === "function") return undefined;
  return value;
}

async function getState() {
  try {
    const result = await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).get();
    let payload = result.data && result.data.payload ? result.data.payload : null;
    if (result.data && result.data.payloadJson) {
      try {
        payload = JSON.parse(result.data.payloadJson);
      } catch (error) {
        payload = result.data.payload || null;
      }
    }
    return {
      ok: true,
      payload,
      updatedAt: result.data && result.data.updatedAt ? result.data.updatedAt : null
    };
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      return {
        ok: true,
        payload: null,
        updatedAt: null
      };
    }
    throw error;
  }
}

async function saveState(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Missing state payload");
  }

  const wxContext = cloud.getWXContext();
  const safePayload = cleanForCloud(payload);
  const data = {
    payloadJson: JSON.stringify(safePayload),
    payloadSummary: {
      todayId: safePayload.todayId || "",
      drawUsed: Boolean(safePayload.drawUsed),
      peopleCount: Array.isArray(safePayload.people) ? safePayload.people.length : 0,
      bearCount: Array.isArray(safePayload.bears) ? safePayload.bears.length : 0,
      actionCount: Array.isArray(safePayload.actions) ? safePayload.actions.length : 0
    },
    updatedAt: db.serverDate(),
    updatedBy: wxContext.OPENID || ""
  };

  try {
    await db.collection(STATE_COLLECTION).doc(STATE_DOC_ID).update({
      data
    });
  } catch (error) {
    if (String(error?.errMsg || "").includes("does not exist")) {
      await db.collection(STATE_COLLECTION).add({
        data: {
          _id: STATE_DOC_ID,
          ...data
        }
      });
    } else {
      throw error;
    }
  }

  return {
    ok: true
  };
}

exports.main = async (event = {}) => {
  try {
    const action = event.action || "get";

    if (action === "get") {
      return getState();
    }

    if (action === "save") {
      return saveState(event.payload);
    }

    throw new Error(`Unsupported state action: ${action}`);
  } catch (error) {
    return {
      ok: false,
      message: error.message || error.errMsg || "state cloud function failed"
    };
  }
};
