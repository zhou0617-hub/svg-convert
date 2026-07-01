# vectorize_config.py
CONFIG = {
    # 图像预处理模块
    "enhance": {
        "enable": True,
        "scale": 1.8,
        "max_side": 2400,
        "denoise_strength": 6,
        "contrast_boost": 1.15
    },
    # 语义分层分割配置
    "segment": {
        "enable": True,
        "line_thickness": 3
    },
    # 渐变生成配置
    "gradient": {
        "enable": False,
        "min_layers": 6,
        "color_similarity": 40,
        "smooth_band": True
    },
    # SVG路径优化配置
    "path_opt": {
        "enable": True,
        "simplify_tolerance": 0.4,
        "min_path_length": 18,
        "merge_same_color": True
    }
}