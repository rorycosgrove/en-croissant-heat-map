import {
  Button,
  Group,
  Popover,
  Slider,
  Stack,
  Switch,
  Text,
  NumberInput,
  SimpleGrid,
} from "@mantine/core";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import type { Role } from "chessops";
import { heatmapSettingsAtom } from "./state";
export function HeatmapControls() {
  const { t } = useTranslation();
  const [settings, setSettings] = useAtom(heatmapSettingsAtom);
  const labels: Record<Role, string> = {
    pawn: t("Heatmap.Pawn", "Pawn"),
    knight: t("Heatmap.Knight", "Knight"),
    bishop: t("Heatmap.Bishop", "Bishop"),
    rook: t("Heatmap.Rook", "Rook"),
    queen: t("Heatmap.Queen", "Queen"),
    king: t("Heatmap.King", "King (influence)"),
  };
  return (
    <Popover width={280} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Button size="compact-xs" variant={settings.enabled ? "light" : "subtle"}>
          {t("Heatmap.Title", "Heatmap")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Switch
            label={t("Heatmap.Enabled", "Thermal landscape")}
            checked={settings.enabled}
            onChange={(e) => setSettings({ ...settings, enabled: e.currentTarget.checked })}
          />
          <Group justify="space-between">
            <Text size="xs" c="blue">
              {t("Heatmap.Cold", "White · cold")}
            </Text>
            <Text size="xs">{t("Heatmap.Neutral", "Neutral")}</Text>
            <Text size="xs" c="red">
              {t("Heatmap.Hot", "Black · hot")}
            </Text>
          </Group>
          <div
            style={{ height: 8, background: "linear-gradient(90deg,#1894ff,transparent,#ff4118)" }}
          />
          <Text size="xs">
            {t("Heatmap.Heuristic", "Weighted heat field, not an engine evaluation.")}
          </Text>
          {(
            [
              ["opacity", t("Heatmap.Opacity", "Opacity"), 0, 1, 0.05],
              ["spread", t("Heatmap.Spread", "Spread"), 0.1, 1.5, 0.05],
              ["decay", t("Heatmap.Decay", "Distance decay"), 0, 2, 0.05],
              ["scale", t("Heatmap.Scale", "Fixed temperature scale"), 1, 100, 1],
            ] as const
          ).map(([key, label, min, max, step]) => (
            <div key={key}>
              <Text size="xs">
                {label}: {settings[key]}
              </Text>
              <Slider
                aria-label={label}
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={(value) => setSettings({ ...settings, [key]: value })}
              />
            </div>
          ))}
          <SimpleGrid cols={2}>
            {(Object.keys(labels) as Role[]).map((role) => (
              <NumberInput
                key={role}
                label={labels[role]}
                size="xs"
                min={0}
                max={30}
                step={0.5}
                value={settings.weights[role]}
                onChange={(value) => {
                  if (typeof value === "number")
                    setSettings({ ...settings, weights: { ...settings.weights, [role]: value } });
                }}
              />
            ))}
          </SimpleGrid>
          <Button variant="subtle" size="xs" onClick={() => setSettings(null)}>
            {t("Heatmap.Reset", "Reset defaults")}
          </Button>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
