const CapabilityMqttHandle = require("./CapabilityMqttHandle");

const capabilities = require("../../core/capabilities");
const Commands = require("../common/Commands");
const ComponentType = require("../homeassistant/ComponentType");
const DataType = require("../homie/DataType");
const EntityCategory = require("../homeassistant/EntityCategory");
const HassAnchor = require("../homeassistant/HassAnchor");
const InLineHassComponent = require("../homeassistant/components/InLineHassComponent");
const Logger = require("../../Logger");
const PropertyMqttHandle = require("../handles/PropertyMqttHandle");
const stateAttrs = require("../../entities/state/attributes");

class PresetSelectionCapabilityMqttHandle extends CapabilityMqttHandle {
    /**
     * @param {object} options
     * @param {import("../handles/RobotMqttHandle")} options.parent
     * @param {import("../MqttController")} options.controller MqttController instance
     * @param {import("../../core/ValetudoRobot")} options.robot
     * @param {import("../../core/capabilities/PresetSelectionCapability")} options.capability
     */
    constructor(options) {
        super(Object.assign(options, {
            friendlyName: CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[options.capability.getType()] + " control"
        }));
        this.capability = options.capability;

        this.registerChild(
            new PropertyMqttHandle({
                parent: this,
                controller: this.controller,
                topicName: "preset",
                friendlyName: CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[options.capability.getType()],
                datatype: DataType.ENUM,
                format: this.capability.getPresets().join(","),
                setter: async (value) => {
                    if (Object.values(Commands.INC_DEC).includes(value)) {
                        const presets = this.capability.getPresets();
                        const attr = this.robot.state.getFirstMatchingAttribute(CAPABILITIES_TO_STATE_ATTR_MAPPING[this.capability.getType()]);
                        if (attr === null) {
                            return;
                        }
                        let valueIndex = presets.indexOf(attr.value);
                        if (valueIndex < 0 || valueIndex >= presets.length) {
                            return;
                        }
                        value = presets[valueIndex];
                    }
                    await this.capability.selectPreset(value);
                },
                getter: async () => {
                    const attr = this.robot.state.getFirstMatchingAttribute(CAPABILITIES_TO_STATE_ATTR_MAPPING[this.capability.getType()]);
                    if (attr === null) {
                        return null;
                    }

                    if (this.capability.getType() === capabilities.FanSpeedControlCapability.TYPE) {
                        await HassAnchor.getAnchor(HassAnchor.ANCHOR.FAN_SPEED).post(attr.value);
                    }

                    return attr.value;
                },
                helpText: "This handle allows setting the " +
                    CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[options.capability.getType()].toLowerCase() + ". " +
                    "It accepts the preset payloads specified in `$format` or in the HAss json attributes.",
                helpMayChange: {
                    "Enum payloads": "Different robot models have different " +
                        CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[options.capability.getType()].toLowerCase() +
                        " presets. Always check `$format`/`json_attributes` during startup."
                }
            }).also((prop) => {
                if (options.capability.getType() === capabilities.FanSpeedControlCapability.TYPE) {

                    // Sent as a topic reference since this is used for the autoconfig
                    HassAnchor.getTopicReference(HassAnchor.REFERENCE.FAN_SPEED_PRESETS).post(this.capability.getPresets()).catch(err => {
                        Logger.error("Error while posting value to HassAnchor", err);
                    });
                    HassAnchor.getTopicReference(HassAnchor.REFERENCE.FAN_SPEED_SET).post(prop.getBaseTopic() + "/set").catch(err => {
                        Logger.error("Error while posting value to HassAnchor", err);
                    });

                } else if (options.capability.getType() === capabilities.WaterUsageControlCapability.TYPE) {
                    this.controller.withHass((hass) => {
                        prop.attachHomeAssistantComponent(
                            new InLineHassComponent({
                                hass: hass,
                                robot: this.robot,
                                name: capabilities.WaterUsageControlCapability.TYPE,
                                friendlyName: CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[capabilities.WaterUsageControlCapability.TYPE],
                                componentType: ComponentType.SELECT,
                                autoconf: {
                                    state_topic: prop.getBaseTopic(),
                                    value_template: "{{ value }}",
                                    command_topic: prop.getBaseTopic() + "/set",
                                    options: this.capability.getPresets(),
                                    icon: "mdi:water-pump",
                                    entity_category: EntityCategory.CONFIG,
                                }
                            })
                        );
                    });

                } else if (options.capability.getType() === capabilities.OperationModeControlCapability.TYPE) {
                    this.controller.withHass((hass) => {
                        prop.attachHomeAssistantComponent(
                            new InLineHassComponent({
                                hass: hass,
                                robot: this.robot,
                                name: capabilities.OperationModeControlCapability.TYPE,
                                friendlyName: CAPABILITIES_TO_FRIENDLY_NAME_MAPPING[capabilities.OperationModeControlCapability.TYPE],
                                componentType: ComponentType.SELECT,
                                autoconf: {
                                    state_topic: prop.getBaseTopic(),
                                    value_template: "{{ value }}",
                                    command_topic: prop.getBaseTopic() + "/set",
                                    options: this.capability.getPresets(),
                                    icon: "mdi:developer-board",
                                    entity_category: EntityCategory.CONFIG,
                                }
                            })
                        );
                    });

                }
            })
        );
    }

    getInterestingStatusAttributes() {
        return [CAPABILITIES_TO_STATE_ATTR_MAPPING[this.capability.getType()]];
    }
}

const CAPABILITIES_TO_FRIENDLY_NAME_MAPPING = {
    [capabilities.FanSpeedControlCapability.TYPE]: "Fan speed",
    [capabilities.WaterUsageControlCapability.TYPE]: "Water grade",
    [capabilities.OperationModeControlCapability.TYPE]: "Operation mode",
};

const CAPABILITIES_TO_STATE_ATTR_MAPPING = {
    [capabilities.FanSpeedControlCapability.TYPE]: {
        attributeClass: stateAttrs.PresetSelectionStateAttribute.name,
        attributeType: stateAttrs.PresetSelectionStateAttribute.TYPE.FAN_SPEED
    },
    [capabilities.WaterUsageControlCapability.TYPE]: {
        attributeClass: stateAttrs.PresetSelectionStateAttribute.name,
        attributeType: stateAttrs.PresetSelectionStateAttribute.TYPE.WATER_GRADE
    },
    [capabilities.OperationModeControlCapability.TYPE]: {
        attributeClass: stateAttrs.PresetSelectionStateAttribute.name,
        attributeType: stateAttrs.PresetSelectionStateAttribute.TYPE.OPERATION_MODE
    },
};

module.exports = PresetSelectionCapabilityMqttHandle;
