import React, { useState } from 'react';
import { BookOpen, GraduationCap, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

const LearningHub = () => {
  const [expandedIdx, setExpandedIdx] = useState(null);

  const guides = [
    {
      title: "Stat Sathi Operation Manual & Included Modules",
      type: "Application Pack & Operations",
      duration: "10 min read",
      description: "A comprehensive reference detailing all analytical modules (Tests, Plots, Regression, Correlation) included in Stat Sathi and how to operate the application.",
      points: [
        "Pack Contents: Stat Sathi contains 10 integrated modules: Descriptive Statistics (summary stats, outlier IQR flags, Shapiro-Wilk), Correlation (Pearson/Spearman matrices, Seaborn heatmaps), Parametric Tests (t-Test, Welch, Paired, One-Sample, Z-Test), Non-Parametric Tests (Mann-Whitney U, Wilcoxon, Kruskal-Wallis, Friedman, Chi-Square contingencies), ANOVA DoE Curation (One/Two-Way CRD/RBD, Split-plot with CD/LSD values & Duncan DMRT letters), Regression (Simple Linear, Multiple OLS, PLSR), Clustering & Risk Zoning (K-Means, Hierarchical Ward linkage, Dendrograms, 2D Scatter Plots with convex hull clouds & centroids), PCA, Plots Visualization (10 publication-ready chart layouts with up to 600 DPI vector downloads), and Field Layout Generator.",
        "Clustering Cloud Upgrade: Offers K-Means & Hierarchical clusterings rendering custom 2D scatter plots enclosed in transparent shaded convex hull boundary 'clouds' (approx 9% opacity) and star centroid markers.",
        "Regression Analysis Pack: Run Simple OLS, Multiple OLS, and Partial Least Squares Regression (PLSR). Outputs OLS standard errors, t-statistics, p-values, F-statistic ANOVA tables, and PLSR components scores, weight vectors, loadings, and Predicted vs. Actual diagnostic fit plots.",
        "How to Operate (Step 1): Register and log in. From the Dashboard click 'Upload Your Dataset' to load CSV or Excel sheets. You can preview raw data records in an interactive grid at any stage using the 'View Data' button.",
        "How to Operate (Step 2): Click any module card to open its workspace. Pick dependent Y and independent X variables. View the statistics tables and pay attention to orange assumption warning banners (e.g. Shapiro-Wilk normality failure).",
        "How to Operate (Step 3): Modify plots typography, axes boundaries, and ticks. Save vector plots (PNG, JPEG, SVG) in standard or presentation DPIs. Click 'Export to Word' to download reports containing centrally aligned, editable HTML tables for MS Word."
      ],
      article: `<h3>Stat Sathi Operations & Layout Guide</h3>
        <p>Stat Sathi is designed to serve as a comprehensive, journal-compliant statistical analytics package for researchers, agricultural scientists, and graduate students. By integrating robust numerical solvers with interactive visualizations, the dashboard simplifies complex calculations into structured, publishable reports.</p>
        
        <h4>1. Standard Operational Flow</h4>
        <p>Operating any analytical module in Stat Sathi follows a standardized three-step workflow:</p>
        <ul>
          <li><strong>Data Upload & Preview:</strong> Click the global dataset uploader on the dashboard to upload your CSV or Excel file. Click the <strong>View Data</strong> grid button to inspect the first 100 rows, ensuring variables are parsed correctly and no unexpected text values contaminate numeric fields.</li>
          <li><strong>Parameter Specification:</strong> Open your target analytical modal. The interface automatically extracts column headers and separates numeric columns. Map your Dependent Variables (Y) and Independent Factors (X) accordingly.</li>
          <li><strong>Assumptions Verification:</strong> Check the diagnostic alerts. If data residuals or group distributions violate standard normality checks (Shapiro-Wilk test yields p < 0.05), Stat Sathi displays a prominent orange warning banner indicating that non-parametric alternatives should be considered.</li>
        </ul>
        
        <h4>2. Advanced High-Resolution Exports</h4>
        <p>All charts generated inside the visualization panels (such as ANOVA post-hoc comparison bar charts, clustering scatter plots, and Predicted vs. Actual fit lines) support professional publication exports. Adjust the typography font styles, font sizes, grid lines, and axis limits, then choose standard (150 DPI), presentation (300 DPI), or publication-grade (600 DPI) resolutions to download vector SVG or high-density PNG files. Export statistical reports as editable HTML tables directly compatible with Microsoft Word.</p>`
    },
    {
      title: "Basic Statistics, Normality & Data Quality",
      type: "Basic Statistics",
      duration: "12 min read",
      description: "Learn the fundamentals of descriptive statistics, testing for normality using Shapiro-Wilk, and programmatically detecting outliers with clear parameter details.",
      points: [
        "Central Tendency: Mean (average), Median (middle value), and Mode (most frequent) describe data centers.",
        "Dispersion & Variation: Standard Deviation (SD) measures spread, Standard Error (SE) measures sample mean precision, and Coefficient of Variation (C.V. %) measures relative variability.",
        "Shape: Skewness measures asymmetry of the distribution, while Kurtosis measures the tailedness (peakedness).",
        "Normality & Outliers: Shapiro-Wilk test checks if data is normally distributed (p < 0.05 rejects normality). Outliers are detected using the standard 1.5 * IQR (Interquartile Range) rule."
      ],
      article: `<h3>Descriptive Statistics & Normality Assumptions</h3>
        <p>Descriptive statistics form the foundational layer of quantitative data analysis, summarizing the core characteristics, spread, and quality of sample observations prior to hypothesis testing.</p>
        
        <div class="my-6">
          <img src="/normal_distribution_stats.png" alt="Normal Distribution Curve & Parameters" />
          <p class="text-[11px] text-slate-400 mt-2 italic text-center">Figure 1: Standard Normal Distribution Curve showing Mean, Median, and Mode centered, along with Standard Deviation (SD) band regions.</p>
        </div>

        <h4>1. Parameters of Central Tendency</h4>
        <div class="parameter-box">
          <p><strong>Mean (μ or X̄):</strong> The arithmetic average of all values. Calculated by summing all values and dividing by the total count: <span class="formula-block">Mean = ∑X / N</span>. It is highly sensitive to extreme outliers.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Median:</strong> The exact midpoint (50th percentile) of a sorted dataset. If N is odd, it is the middle value; if N is even, it is the average of the two middle values. Unlike the Mean, the Median is highly robust against outliers.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Mode:</strong> The most frequently occurring value in the dataset. A dataset can have one mode (unimodal), multiple (multimodal), or none.</p>
        </div>

        <h4>2. Parameters of Dispersion & Relative Spread</h4>
        <div class="parameter-box">
          <p><strong>Standard Deviation (SD):</strong> The absolute measure of spread. It quantifies the average deviation of each data point from the mean: <span class="formula-block">SD = √[ ∑(X - X̄)² / (N - 1) ]</span>. In a normal distribution, ~68.2% of data points fall within ±1 SD, and ~95.4% fall within ±2 SD of the mean.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Standard Error of Mean (SE):</strong> Indicates the precision of your sample mean as an estimate of the true population mean. It decreases as sample size increases: <span class="formula-block">SE = SD / √N</span>.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Coefficient of Variation (C.V. %):</strong> A standardized, unitless measure of relative variability, expressed as a percentage: <span class="formula-block">C.V.% = (SD / Mean) × 100</span>. It is ideal for comparing dispersion between different variables with different units or scales (e.g. comparing height in cm vs. weight in kg).</p>
        </div>

        <h4>3. Parameters of Distribution Shape</h4>
        <div class="parameter-box">
          <p><strong>Skewness:</strong> Measures the asymmetry of the distribution. A value of 0 indicates perfect symmetry. Positive skewness (> 0) means a long right tail (median < mean), typical of wealth or yield data. Negative skewness (< 0) means a long left tail (mean < median).</p>
        </div>
        <div class="parameter-box">
          <p><strong>Kurtosis:</strong> Measures the 'tailedness' or peakedness of the distribution. Positive kurtosis (leptokurtic) indicates heavy, thick tails with a sharp central peak. Negative kurtosis (platykurtic) indicates thin, light tails with a flat, spread-out top.</p>
        </div>

        <h4>4. Normality & Data Quality Rules</h4>
        <div class="parameter-box">
          <p><strong>Shapiro-Wilk Test (W and p-value):</strong> Checks the null hypothesis (H₀) that the sample data is normally distributed. W ranges between 0 and 1; values close to 1 support normality. If the p-value is less than 0.05, we reject the null hypothesis and conclude that the data is significantly non-normal, necessitating non-parametric tests.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Outliers (1.5 * IQR Rule):</strong> The Interquartile Range (IQR) measures the middle 50% spread: <span class="formula-block">IQR = Q3 - Q1</span>. Outliers are defined as values falling below <span class="formula-block">Q1 - 1.5 * IQR</span> or above <span class="formula-block">Q3 + 1.5 * IQR</span>.</p>
        </div>`
    },
    {
      title: "Pearson vs. Spearman Correlation & Matrix Heatmaps",
      type: "Correlation Guide",
      duration: "10 min read",
      description: "A guide on selecting between parametric Pearson and non-parametric Spearman correlation coefficients, and interpreting matrix heatmaps.",
      points: [
        "Pearson Correlation: Measures linear relationships between normally distributed continuous variables. Sensitive to outliers.",
        "Spearman Rank Correlation: Measures monotonic relationships. Ideal for non-normal continuous data, ordinal ranks, and robust against outliers.",
        "Matrix Heatmaps: Visualizes coefficients from -1 (perfect negative) to +1 (perfect positive). Darker colors indicate stronger relationships, and coefficients are checked for significance."
      ],
      article: `<h3>Pearson Linear vs. Spearman Rank Correlation</h3>
        <p>Correlation analysis quantifies the strength and direction of the relationship between two variables, returning a coefficient (r or ρ) bounded between -1.00 and +1.00.</p>
        
        <div class="my-6">
          <img src="/correlation_types.png" alt="Correlation Types Scatter Plots" />
          <p class="text-[11px] text-slate-400 mt-2 italic text-center">Figure 2: Comparison of Correlation Strengths: Strong Positive (left), Strong Negative (center), and No Correlation (right).</p>
        </div>

        <h4>1. Correlation Coefficients Comparison</h4>
        <div class="parameter-box">
          <p><strong>Pearson Correlation Coefficient (r):</strong> The standard parametric measure. Evaluates the strength and direction of a linear relationship between two continuous variables: <span class="formula-block">r = ∑((X - X̄)(Y - Ȳ)) / √[ ∑(X - X̄)² ∑(Y - Ȳ)² ]</span>. It assumes both variables are normally distributed and homoscedastic. It is highly sensitive to outliers, which can easily distort the coefficient.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Spearman Rank Correlation Coefficient (ρ):</strong> A non-parametric alternative. Instead of using raw data points, it converts values into ordinal ranks and calculates Pearson's correlation on those ranks. It evaluates monotonic relationships (whether variables increase or decrease together, even if not in a straight line). It is ideal for skewed data, ordinal scales (e.g. soil fertility ranks 1-5), and is highly robust against outliers.</p>
        </div>

        <h4>2. Interpreting the Parameters</h4>
        <div class="parameter-box">
          <p><strong>Correlation Strength:</strong> Bounded between -1.00 and +1.00:
            <br />• <strong>+1.00:</strong> Perfect positive correlation (as X increases, Y increases in a perfect straight line).
            <br />• <strong>-1.00:</strong> Perfect negative correlation (as X increases, Y decreases in a perfect straight line).
            <br />• <strong>0.00:</strong> No linear association.
            <br />• <strong>|r| ≥ 0.70:</strong> Strong correlation.
            <br />• <strong>0.40 ≤ |r| < 0.70:</strong> Moderate correlation.
            <br />• <strong>|r| < 0.40:</strong> Weak correlation.
          </p>
        </div>
        <div class="parameter-box">
          <p><strong>Significance p-value:</strong> Evaluates whether the correlation coefficient is statistically different from zero. A p-value < 0.05 rejects the null hypothesis (H₀: r = 0), indicating that the correlation observed in the sample represents a true population relationship.</p>
        </div>

        <h4>3. Reading Matrix Heatmaps</h4>
        <p>A correlation matrix heatmap maps coefficients into a symmetric grid. The color gradient (typically cool blue for negative relationships and warm red for positive relationships) lets researchers scan hundreds of variable pairs instantly. In Stat Sathi, significant correlations are marked with stars (e.g., * for p < 0.05) to highlight robust predictors for multi-variable modeling.</p>`
    },
    {
      title: "Linear Regression: OLS Simple/Multiple & Partial Least Squares (PLSR)",
      type: "Regression Guide",
      duration: "15 min read",
      description: "Understand Simple Linear Regression, Multiple OLS Regression, and PLSR for single or multi-target multivariate predictors with detailed parameter guides.",
      points: [
        "Simple Linear Regression: Models relationship between one dependent (Y) and one independent (X) variable using Ordinary Least Squares (OLS).",
        "Multiple OLS Regression: Models one dependent (Y) against two or more independent (X) variables. Assumes independence, normality, and equal variance of residuals.",
        "Partial Least Squares (PLSR): A covariance-based dimensionality reduction technique that fits multiple dependent (Y) targets on multiple independent (X) variables. Optimal when predictors are collinear or exceed sample size.",
        "Diagnostic Fit Plots: Evaluates model quality by plotting Predicted vs. Actual values. Closer alignment to the 45-degree diagonal perfect-fit line indicates superior performance."
      ],
      article: `<h3>Regression Modeling: OLS & Partial Least Squares</h3>
        <p>Regression analysis models the predictive pathways between independent predictor variables and dependent outcomes, estimating effects and predicting future values.</p>
        
        <div class="my-6">
          <img src="/regression_residuals.png" alt="OLS Regression Line and Residuals" />
          <p class="text-[11px] text-slate-400 mt-2 italic text-center">Figure 3: Ordinary Least Squares (OLS) Linear Regression line fitted to a scatter plot, showing residual error gaps.</p>
        </div>

        <h4>1. Ordinary Least Squares (OLS) Parameters</h4>
        <p>OLS regression estimates the linear equation <span class="formula-block">Y = β₀ + β₁X₁ + ... + βₖXₖ + ε</span> by minimizing the sum of squared residual errors (observed minus predicted values).</p>
        
        <div class="parameter-box">
          <p><strong>Intercept (β₀):</strong> The expected value of the dependent variable Y when all independent variables (X) are equal to zero. If 0 is outside your data range, the intercept serves purely as a mathematical anchor.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Coefficient / Slope (βᵢ):</strong> The estimated effect of predictor Xᵢ. It represents the change in Y for a one-unit increase in Xᵢ, assuming all other predictors in the model are held constant.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Standard Error (SE) of Coefficient:</strong> Indicates the precision of the estimated coefficient. Smaller SE values mean more stable estimates across random samples.</p>
        </div>
        <div class="parameter-box">
          <p><strong>t-statistic:</strong> Evaluates if a predictor is significant. It is the coefficient divided by its standard error: <span class="formula-block">t = βᵢ / SE(βᵢ)</span>. A large absolute t-value (typically |t| > 2) indicates that the predictor has a significant effect.</p>
        </div>
        <div class="parameter-box">
          <p><strong>p-value (Coefficient):</strong> The probability of finding a t-statistic this extreme under the null hypothesis (H₀: βᵢ = 0). If p < 0.05, we reject the null hypothesis and conclude the predictor is significantly related to Y.</p>
        </div>

        <h4>2. Model Diagnostics Parameters</h4>
        <div class="parameter-box">
          <p><strong>R-squared (R²):</strong> The Coefficient of Determination. Represents the proportion of total variance in the dependent variable explained by the independent variables. Ranges from 0 (no variance explained) to 1 (all variance explained).</p>
        </div>
        <div class="parameter-box">
          <p><strong>Adjusted R-squared (R²_adj):</strong> Modifies R-squared to account for the number of predictors. Adding variables will always increase or maintain R², but Adjusted R-squared will penalize adding redundant, non-predictive variables: <span class="formula-block">R²_adj = 1 - [ (1 - R²)(N - 1) / (N - k - 1) ]</span>.</p>
        </div>
        <div class="parameter-box">
          <p><strong>F-statistic & Overall p-value:</strong> Tests the overall model significance. It evaluates the null hypothesis that all slope coefficients are simultaneously zero (H₀: β₁ = β₂ = ... = 0). If the F-test p-value < 0.05, the model fits the data significantly better than a simple flat line using just the Mean.</p>
        </div>

        <h4>3. Partial Least Squares Regression (PLSR) Parameters</h4>
        <p>PLSR projects collinear predictors (highly correlated variables) and multi-target dependent variables (Y) into a lower-dimensional space of latent components, maximizing the covariance between the X and Y blocks.</p>
        
        <div class="parameter-box">
          <p><strong>Latent Components:</strong> New orthogonal axes constructed from the X variables. The first component explains the largest chunk of covariance, and subsequent components capture remaining trends.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Loadings (X & Y loadings):</strong> Define how much each original variable contributes to the latent components. High loadings indicate a strong influence on that component.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Weights (X & Y weights):</strong> The coefficients used to construct the linear combinations of components, showing the direction of projection.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Scores:</strong> The coordinates of your original observations mapped onto the new latent components, ideal for visualizing groupings or outliers.</p>
        </div>`
    },
    {
      title: "ANOVA & Experimental Designs: CRD, RBD, Split-Plot & Duncan DMRT",
      type: "ANOVA & Plot Designs",
      duration: "15 min read",
      description: "A comprehensive guide on agricultural layout designs, Critical Difference (CD), standard errors, and post-hoc Duncan lettering.",
      points: [
        "Completely Randomized Design (CRD): Simplest design for homogeneous environments (e.g., laboratories). Evaluates treatments without blocking factors.",
        "Randomized Block Design (RBD): Standard field layout that groups experimental units into blocks (replications) to isolate gradient variance (e.g., soil fertility, slope).",
        "Split-Plot Design: Multi-error design where one factor (main-plot, e.g. tillage) requires larger plots, while another factor (sub-plot, e.g. fertilizer) is randomized inside.",
        "Pairwise Separation (Duncan DMRT): Uses Studentized Range values to group treatment means. Contiguous non-significant groups are assigned letters (a, b, ab) at the 5% Critical Difference (CD/LSD) level."
      ],
      article: `<h3>Analysis of Variance & Experimental Plot Designs</h3>
        <p>In agricultural and environmental sciences, experimental designs control environmental noise (soil gradient, moisture, wind) and isolate actual treatment effects using blocking and plot subdivisions.</p>
        
        <div class="my-6">
          <img src="/experimental_layouts.png" alt="Agricultural Experimental Layouts CRD vs RBD" />
          <p class="text-[11px] text-slate-400 mt-2 italic text-center">Figure 4: Field Layout Schemes: Completely Randomized Design (CRD, left) vs. Randomized Block Design with blocking rows (RBD, right).</p>
        </div>

        <h4>1. Primary Experimental Layout Parameters</h4>
        <div class="parameter-box">
          <p><strong>Completely Randomized Design (CRD):</strong> Best suited for highly homogeneous environments like laboratories, growth chambers, or greenhouses. Treatments are assigned purely at random with no grouping. It has a single residual error term.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Randomized Block Design (RBD):</strong> The classic agricultural field layout. If a gradient (e.g. soil fertility slope) runs in one direction, plots are grouped into blocks (replications) perpendicular to the gradient. Blocks isolate replication-to-replication noise from the residual error: <span class="formula-block">SS_Total = SS_Treatments + SS_Blocks + SS_Error</span>.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Split-Plot Design:</strong> Used when factors require different-sized plots due to operational limits (e.g., irrigation or tillage requires a large main-plot, while fertilizer levels can be applied in small sub-plots). It divides variance into main-plot error (Error A) and sub-plot error (Error B), which requires distinct comparisons.</p>
        </div>

        <h4>2. ANOVA Table Parameters Explained</h4>
        <div class="parameter-box">
          <p><strong>Source of Variation (SOV):</strong> The factors influencing the dependent variable (e.g., Treatment, Block/Replication, Error).</p>
        </div>
        <div class="parameter-box">
          <p><strong>Degrees of Freedom (DF):</strong> The number of independent data points available for estimating variability. Typically: Treatment DF = t - 1, Replication DF = r - 1, Total DF = N - 1.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Sum of Squares (SS):</strong> The sum of squared deviations from the grand mean, representing the total variation explained by that factor.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Mean Square (MS):</strong> The variance estimate. Calculated by dividing Sum of Squares by Degrees of Freedom: <span class="formula-block">MS = SS / DF</span>.</p>
        </div>
        <div class="parameter-box">
          <p><strong>F-value:</strong> The test statistic, calculated as: <span class="formula-block">F = MS_Factor / MS_Error</span>. If F is significantly greater than 1 (yielding p < 0.05), it indicates the differences between treatments are much larger than random variation.</p>
        </div>

        <h4>3. Pairwise Comparison & Mean Groupings</h4>
        <div class="parameter-box">
          <p><strong>Standard Error of Mean (SE(m)):</strong> The standard deviation of the sample treatment mean: <span class="formula-block">SE(m) = √(MS_Error / r)</span>.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Standard Error of Difference (SE(d)):</strong> The standard deviation of the difference between two treatment means: <span class="formula-block">SE(d) = √(2 * MS_Error / r)</span>. For Split-plots, this is calculated separately for Factor A, Factor B, and their interaction levels.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Critical Difference (C.D. or LSD):</strong> The minimum difference required between any two treatment means to conclude that they are statistically different at a specified significance level (5% or 1%): <span class="formula-block">C.D. = t_(α/2, Error_DF) × SE(d)</span>. If Mean difference > C.D., the difference is statistically significant.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Duncan's DMRT letters:</strong> An alphabetical grouping system. Treatments that are not significantly different at the 5% C.D. level share a letter (e.g. Treatments with mean 42.5 'a' and 40.2 'ab' do not differ, but 35.1 'b' is significantly lower than 'a').</p>
        </div>`
    },
    {
      title: "What is Clustering? K-Means vs. Hierarchical Ward & Convex Hull Clouds",
      type: "Clustering Guide",
      duration: "11 min read",
      description: "Explore unsupervised grouping algorithms, reading dendrogram trees, and visualizing cluster boundaries using convex hulls with clear parameters.",
      points: [
        "K-Means Clustering: Groups data into K pre-defined clusters by minimizing squared distances (inertia) between observations and cluster centroids.",
        "Hierarchical Ward Linkage: Agglomerative clustering that starts with individual points and merges them sequentially to minimize within-cluster variance, outputting a tree-like dendrogram.",
        "Dendrogram Cut-Height: Shifting the cut-line height on the dendrogram tree dynamically adjusts the distance threshold, changing the number of clusters identified.",
        "Cluster Envelopes (Clouds): Standard K-Means cluster scatter plots are enclosed in transparent convex hulls (enclosing boundaries) with centroid markers to optimize group boundaries."
      ],
      article: `<h3>Unsupervised Clustering & Spatial Zoning</h3>
        <p>Clustering algorithms group observations together based on numerical similarity across multiple variables, exposing patterns and zoning boundaries without prior labeling.</p>
        
        <div class="my-6">
          <img src="/cluster_convex_hulls.png" alt="K-Means Clusters with Convex Hull Clouds" />
          <p class="text-[11px] text-slate-400 mt-2 italic text-center">Figure 5: K-Means Clustering scatter plot showing 3 distinct groups enclosed in transparent convex hull boundary clouds with star centroid markers.</p>
        </div>

        <h4>1. Clustering Parameters & Algorithms</h4>
        <div class="parameter-box">
          <p><strong>K-Means Clustering:</strong> A partitioning algorithm that groups data points into exactly K clusters. It works by setting K random centroids, assigning each data point to its nearest centroid, updating centroids to be the mean coordinate of the group, and repeating until centroids stop moving. It works best on spherical, similarly sized clusters.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Hierarchical Agglomerative Clustering:</strong> A bottom-up approach. It starts with every individual point as its own cluster. At each step, it merges the two closest clusters. <strong>Ward's Linkage Method</strong> minimizes the total within-cluster variance at each merge step, producing balanced, spherical clusters. It builds a hierarchical tree (Dendrogram).</p>
        </div>

        <h4>2. Clustering Metrics & Visual Parameters</h4>
        <div class="parameter-box">
          <p><strong>Inertia / WCSS (Within-Cluster Sum of Squares):</strong> The metric optimized by K-Means: <span class="formula-block">WCSS = ∑[ (X_i - Centroid_c)² ]</span>. It measures how tight/dense the clusters are. As K increases, WCSS decreases. The 'Elbow Method' plots WCSS against K; the 'elbow' point represents the optimal trade-off between grouping detail and number of clusters.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Dendrogram Cut-Height:</strong> The distance threshold line drawn horizontally across the dendrogram tree. Changing the cut-height splits or merges tree branches, dynamically updating cluster groupings and cluster count.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Centroid:</strong> The multi-dimensional average coordinate of a cluster. In K-Means, centroids represent the typical profile of each cluster zone.</p>
        </div>
        <div class="parameter-box">
          <p><strong>Convex Hull Clouds:</strong> A convex hull is the smallest polygon enclosing all data points of a cluster in 2D space (like stretching a rubber band around the outer points). Stat Sathi draws these transparent clouds (at 9% opacity) with matching dotted borders, defining the visual zone of each cluster and making overlaps easy to analyze.</p>
        </div>`
    }
  ];


  return (
    <div className="flex-1 p-8 animate-fade-in">
      {/* Header section */}
      <div className="border-b border-slate-200/50 pb-6 mb-8">
        <h1 className="font-display text-2xl font-extrabold text-slate-800 tracking-tight">
          Learning Hub
        </h1>
        <p className="font-sans text-sm text-slate-500 mt-1">
          Select an article below to expand and read full reference guides for academic research writing.
        </p>
      </div>

      {/* Guides Listing */}
      <div className="space-y-6">
        {guides.map((guide, idx) => {
          const isExpanded = expandedIdx === idx;
          return (
            <div 
              key={idx}
              onClick={() => {
                if (!isExpanded) {
                  setExpandedIdx(idx);
                }
              }}
              className={`rounded-3xl border bg-white p-6 shadow-md transition-all duration-300 ${
                isExpanded 
                  ? 'border-brand-indigo/50 shadow-lg' 
                  : 'border-slate-100 shadow-slate-100/50 hover:shadow-lg hover:border-slate-200 cursor-pointer transform hover:-translate-y-0.5'
              }`}
            >
              {/* Header Top Bar */}
              <div 
                onClick={(e) => {
                  if (isExpanded) {
                    e.stopPropagation();
                    setExpandedIdx(null);
                  }
                }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-50 pb-4 mb-4 gap-2 cursor-pointer select-none"
              >
                <div className="flex items-center space-x-2">
                  <GraduationCap className="h-5 w-5 text-brand-indigo" />
                  <span className="font-sans text-xs font-bold text-brand-indigo uppercase tracking-wider">
                    {guide.type}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-sans text-xs text-slate-400 font-semibold bg-slate-50 px-2.5 py-1 rounded-full">
                    {guide.duration}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-4.5 w-4.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-4.5 w-4.5 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Title */}
              <h3 
                onClick={(e) => {
                  if (isExpanded) {
                    e.stopPropagation();
                    setExpandedIdx(null);
                  }
                }}
                className="font-display text-base font-bold text-slate-800 hover:text-brand-indigo transition-colors cursor-pointer flex items-center justify-between select-none"
              >
                <span>{guide.title}</span>
              </h3>
              
              <p className="font-sans text-xs text-slate-400 mt-2 leading-relaxed">
                {guide.description}
              </p>

              {/* Collapsed CTA Button */}
              {!isExpanded && (
                <div className="mt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIdx(idx);
                    }}
                    className="inline-flex items-center space-x-2 rounded-2xl bg-indigo-50 hover:bg-brand-indigo hover:text-white border border-indigo-100/50 px-4 py-2 font-sans text-xs font-bold text-brand-indigo transition-all duration-200 cursor-pointer shadow-xs"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Expand & Read Article</span>
                  </button>
                </div>
              )}

              {/* Expanded Area */}
              {isExpanded && (
                <div className="mt-6 space-y-6 border-t border-slate-100 pt-6 animate-fade-in">
                  
                  {/* Key Takeaways */}
                  <div className="rounded-2xl bg-indigo-50/30 p-4 border border-indigo-50/50">
                    <h4 className="font-display text-xs font-bold text-slate-700 mb-2">Key Takeaways:</h4>
                    <ul className="space-y-2">
                      {guide.points.map((pt, pIdx) => (
                        <li key={pIdx} className="flex items-start space-x-2 font-sans text-xs text-slate-500 leading-normal">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-indigo mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Article Text Content */}
                  <div 
                    className="prose prose-slate max-w-none font-sans text-xs text-slate-600 leading-relaxed space-y-3 pt-2 border-t border-slate-100/50"
                    dangerouslySetInnerHTML={{ __html: guide.article }}
                  />

                  {/* Collapse CTA Button */}
                  <div className="mt-4 flex justify-start">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedIdx(null);
                      }}
                      className="inline-flex items-center space-x-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-200/50 px-4 py-2 font-sans text-xs font-bold text-slate-600 transition-all duration-200 cursor-pointer"
                    >
                      <span>Collapse Article</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LearningHub;
