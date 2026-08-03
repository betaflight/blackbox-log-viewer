import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import HeaderDialog from "./HeaderDialog.vue";
import ParamTable from "./ParamTable.vue";
import { FIRMWARE_TYPE_ROTORFLIGHT } from "../flightlog_fielddefs.js";

function mountWithSysConfig(sysConfig) {
  return mount(HeaderDialog, {
    props: { open: true, sysConfig },
    shallow: true,
    global: {
      renderStubDefaultSlot: true,
    },
  });
}

function yawPrecompPaneParams(wrapper) {
  const pane = wrapper.find('[data-group="Yaw Precompensation"]');
  if (!pane.exists()) {
    return null;
  }
  return pane.findComponent(ParamTable).props("params");
}

describe("HeaderDialog Yaw Precompensation pane", () => {
  it("shows piro compensation and yaw precomp values parsed from the log header", () => {
    const wrapper = mountWithSysConfig({
      firmwareType: FIRMWARE_TYPE_ROTORFLIGHT,
      firmwareVersion: "4.6.0",
      piro_compensation: 1,
      yaw_precomp: [10, 20, 30],
      yaw_precomp_impulse: [5, null],
    });

    const params = yawPrecompPaneParams(wrapper);
    expect(params).not.toBeNull();

    const byName = Object.fromEntries(params.map((p) => [p.name, p.value]));
    expect(byName["Piro Compensation"]).toBe("ON");
    expect(byName["Cutoff"]).toBe("10");
    expect(byName["Cyclic"]).toBe("20");
    expect(byName["Collective"]).toBe("30");
    expect(byName["Impulse Gain"]).toBe("5");
    // Impulse Decay was null in the header -> dropped entirely, matching every other
    // param() field in this file (missing values are filtered out, not shown as "-").
    expect(byName["Impulse Decay"]).toBeUndefined();
  });

  it("hides the whole pane when the log has none of these header fields", () => {
    const wrapper = mountWithSysConfig({
      firmwareType: FIRMWARE_TYPE_ROTORFLIGHT,
      firmwareVersion: "4.6.0",
    });

    expect(wrapper.find('[data-group="Yaw Precompensation"]').exists()).toBe(false);
  });
});
