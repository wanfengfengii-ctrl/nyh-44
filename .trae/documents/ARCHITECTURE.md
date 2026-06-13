## 1. 架构设计

```mermaid
flowchart LR
    "UI 层 (Svelte 组件)" --> "状态管理层 (Svelte Store)"
    "状态管理层 (Svelte Store)" --> "计算引擎层 (Propagation Engine)"
    "计算引擎层 (Propagation Engine)" --> "渲染层 (Cytoscape.js + Chart.js)"
    "渲染层 (Cytoscape.js + Chart.js)" --> "UI 层 (Svelte 组件)"
    "状态管理层 (Svelte Store)" --> "持久化层 (LocalStorage)"
```

## 2. 技术描述
- 前端框架：SvelteKit 2.x + TypeScript 5.x
- UI 组件库：Skeleton UI v3（基于 Tailwind CSS）
- 图可视化：Cytoscape.js + cytoscape-svg 扩展
- 数据图表：Chart.js v4
- 状态管理：Svelte 内置 writable stores
- 持久化：浏览器 LocalStorage + JSON 序列化
- 构建工具：Vite（SvelteKit 内置）
- 样式方案：Tailwind CSS + Skeleton UI 主题

## 3. 路由定义
| 路由 | 用途 |
|------|------|
| / | 主页：模拟工作台（唯一页面） |

## 4. 核心类型定义

```typescript
// 点位类型
export type PointType = 'lighthouse' | 'coast' | 'rock' | 'port' | 'ship';

export interface MapPoint {
  id: string;
  type: PointType;
  label: string;
  number: number;
  x: number;
  y: number;
  radius?: number;
}

// 岩壁障碍物
export interface RockObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// 天气参数
export interface WeatherParams {
  windDirection: number;
  windSpeed: number;
  humidity: number;
  bellFrequency: number;
}

// 传播计算结果
export interface PropagationResult {
  direction: number;
  maxRange: number;
  attenuation: number;
  blocked: boolean;
}

// 完整方案
export interface SimulationScheme {
  id: string;
  name: string;
  createdAt: number;
  points: MapPoint[];
  rocks: RockObstacle[];
  weather: WeatherParams;
}
```

## 5. 项目结构

```
src/
├── lib/
│   ├── types/
│   │   └── simulation.ts          # 核心类型定义
│   ├── stores/
│   │   ├── pointsStore.ts         # 点位状态
│   │   ├── weatherStore.ts        # 天气参数状态
│   │   └── schemeStore.ts         # 方案管理状态
│   ├── engine/
│   │   ├── propagation.ts         # 传播计算引擎
│   │   └── validation.ts          # 输入验证逻辑
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── SimulationCanvas.svelte   # Cytoscape 主画布
│   │   │   ├── PropagationLayer.svelte   # 传播扇区覆盖层
│   │   │   └── ElementsRenderer.svelte   # 点位/岩壁渲染
│   │   ├── controls/
│   │   │   ├── Toolbar.svelte            # 左侧工具栏
│   │   │   ├── WeatherPanel.svelte       # 右侧天气参数面板
│   │   │   └── ValidationAlerts.svelte   # 验证提示
│   │   ├── charts/
│   │   │   └── IntensityRadar.svelte     # Chart.js 极坐标图
│   │   └── scheme/
│   │       ├── SaveSchemeModal.svelte    # 保存方案弹窗
│   │       └── LoadSchemeModal.svelte    # 加载方案弹窗
│   └── utils/
│       ├── geometry.ts              # 几何计算工具
│       └── storage.ts               # LocalStorage 封装
├── routes/
│   └── +page.svelte              # 主页面
├── app.html
└── app.css
```

## 6. 核心算法说明

### 6.1 钟声传播计算
1. **基础模型**：采用修正的声学传播公式，考虑球面扩散衰减 + 空气吸收衰减
2. **风向影响**：顺风方向传播距离增加（与风速正相关），逆风方向距离缩短
3. **湿度影响**：高湿度增加空气吸收系数，尤其对高频信号衰减更显著
4. **频率影响**：高频信号衰减更快，低频传播更远

### 6.2 遮蔽检测算法
1. 从灯塔位置向目标方向发射射线
2. 检测射线与所有岩壁障碍物（矩形）的相交情况
3. 完全被遮挡 → 标记 blocked=true，传播距离=遮挡前距离
4. 部分遮挡 → 计算遮挡比例，额外增加衰减系数

### 6.3 输入验证
1. **点位编号唯一性**：新建/修改时检查编号是否已存在
2. **风速/频率边界**：确保 > 0，湿度 0-100
3. **位置重叠检测**：计算元素中心点距离，小于阈值时提示警告
