#include "SelectableTextShadowNode.h"

#include <fbjni/fbjni.h>
#include <react/jni/ReadableNativeMap.h>
#include <react/renderer/core/LayoutConstraints.h>
#include <react/renderer/core/conversions.h>

namespace facebook::react {

extern const char SelectableTextComponentName[] = "SelectableText";

void SelectableTextShadowNode::setContextContainer(
    std::shared_ptr<const ContextContainer> contextContainer) {
  ensureUnsealed();
  contextContainer_ = std::move(contextContainer);
}

Size SelectableTextShadowNode::measureContent(
    const LayoutContext& /*layoutContext*/,
    const LayoutConstraints& layoutConstraints) const {
  static auto measure =
      jni::findClassStatic("com/facebook/react/fabric/FabricUIManager")
          ->getMethod<jlong(
              jint,
              jstring,
              ReadableMap::javaobject,
              ReadableMap::javaobject,
              ReadableMap::javaobject,
              jfloat,
              jfloat,
              jfloat,
              jfloat)>("measure");

  const auto& props = getConcreteProps();
  auto propsRNM = ReadableNativeMap::newObjectCxxArgs(
      folly::dynamic::object("text", props.text)(
          "fontFamily", props.fontFamily)("fontSize", props.fontSize));
  auto propsRM = jni::make_local(
      reinterpret_cast<ReadableMap::javaobject>(propsRNM.get()));

  return yogaMeassureToSize(measure(
      contextContainer_->at<jni::global_ref<jobject>>("FabricUIManager"),
      getSurfaceId(),
      jni::make_jstring(SelectableTextComponentName).get(),
      nullptr,
      propsRM.get(),
      nullptr,
      layoutConstraints.minimumSize.width,
      layoutConstraints.maximumSize.width,
      layoutConstraints.minimumSize.height,
      layoutConstraints.maximumSize.height));
}

} // namespace facebook::react
