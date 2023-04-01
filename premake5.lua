include "../../premake/common_premake_defines.lua"

project "yoga"
	kind "StaticLib"
	language "C++"
	cppdialect "C++latest"
	cdialect "C17"
	targetname "%{prj.name}"
	inlining "Auto"

	files {
		"./yoga/**.h",
		"./yoga/**.cpp"
	}

	includedirs {
		"%{IncludeDir.yoga}"
	}